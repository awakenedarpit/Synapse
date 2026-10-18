import { GoogleGenAI } from "@google/genai";

export type AIProvider = "gemini" | "groq" | "openrouter";
type GenerateOptions = { json?: boolean; excludeProviders?: AIProvider[] };

export class AIProviderError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AIProviderError";
    this.status = status;
  }
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function configuredProviders(): AIProvider[] {
  const defaults: AIProvider[] = ["gemini", "groq", "openrouter"];
  const configured = (process.env.AI_PROVIDER_PRIORITY || defaults.join(","))
    .split(",").map((provider) => provider.trim().toLowerCase())
    .filter((provider): provider is AIProvider => provider === "gemini" || provider === "groq" || provider === "openrouter");
  const unique = Array.from(new Set(configured));
  return unique.length ? unique : defaults;
}
function hasKey(provider: AIProvider): boolean {
  if (provider === "gemini") return Boolean(process.env.GEMINI_API_KEY);
  if (provider === "groq") return Boolean(process.env.GROQ_API_KEY);
  return Boolean(process.env.OPENROUTER_API_KEY);
}
export function getPrimaryAIProvider(): AIProvider | undefined {
  return configuredProviders().find(hasKey);
}

function modelFor(provider: AIProvider): string {
  if (provider === "gemini") return process.env.GEMINI_CHAT_MODEL || "gemini-3.5-flash";
  if (provider === "groq") return process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-20b";
  return process.env.OPENROUTER_CHAT_MODEL || "openai/gpt-oss-20b:free";
}
async function callProvider(provider: AIProvider, prompt: string, json: boolean): Promise<string> {
  if (provider === "gemini") {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await ai.models.generateContent({
      model: modelFor(provider), contents: prompt,
      config: json ? { responseMimeType: "application/json" } : undefined,
    });
    const text = response.text?.trim();
    if (!text) throw new Error("Gemini returned an empty response.");
    return text;
  }
  const isGroq = provider === "groq";
  const endpoint = isGroq ? "https://api.groq.com/openai/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
  const apiKey = isGroq ? process.env.GROQ_API_KEY : process.env.OPENROUTER_API_KEY;
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  if (!isGroq) {
    headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL || "http://localhost:3000";
    headers["X-Title"] = process.env.OPENROUTER_APP_NAME || "Graph Memory Agent";
  }
  const response = await fetch(endpoint, {
    method: "POST", headers, signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      model: modelFor(provider), messages: [{ role: "user", content: prompt }],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  const payload = await response.json().catch(() => ({})) as {
    error?: { message?: string } | string;
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  };
  if (!response.ok) {
    const detail = typeof payload.error === "string" ? payload.error : payload.error?.message;
    const error = new Error(`${provider} API returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  const content = payload.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content.trim() : Array.isArray(content) ? content.map((part) => part.text || "").join("").trim() : "";
  if (!text) throw new Error(`${provider} returned an empty response.`);
  return text;
}

/** Try configured providers in order; quota and transient errors fall through to the next key. */
export async function generateTextWithFallback(prompt: string, options: GenerateOptions = {}): Promise<string> {
  const excluded = new Set(options.excludeProviders || []);
  const providers = configuredProviders().filter((provider) => !excluded.has(provider) && hasKey(provider));
  if (!providers.length) {
    const missing = (excluded.has("gemini") ? ["GROQ_API_KEY", "OPENROUTER_API_KEY"] : ["GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY"])
      .filter((key) => !process.env[key]);
    throw new AIProviderError(
      `No eligible AI provider is configured. Add a valid key for one of these server environment variables: ${missing.join(", ") || "GROQ_API_KEY or OPENROUTER_API_KEY"}. Restart the Next.js dev server after editing .env.local.`,
      503,
    );
  }
  const failures: string[] = [];
  const statuses: number[] = [];
  for (const provider of providers) {
    try {
      const text = await callProvider(provider, prompt, options.json === true);
      console.info(`[AI ROUTER] Request completed with provider: ${provider}`);
      return text;
    } catch (error) {
      const status = errorStatus(error);
      if (status) statuses.push(status);
      failures.push(provider);
      console.error(`[AI ROUTER] Provider ${provider} failed${status ? ` with HTTP ${status}` : ""}; trying next configured provider.`);
    }
  }
  const status = statuses.length > 0 && statuses.every((value) => value === 429) ? 429 : statuses.includes(503) ? 503 : 502;
  throw new AIProviderError(`All configured AI providers failed: ${failures.join(", ")}.`, status);
}
