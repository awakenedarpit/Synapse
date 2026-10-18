import assert from "node:assert/strict";
import { test } from "node:test";
import { AIProviderError, generateTextWithFallback, getPrimaryAIProvider } from "./ai-router.ts";

function withEnv(values: Record<string, string | undefined>, action: () => Promise<void>) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return action().finally(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("falls through from a failing Groq provider to OpenRouter in configured order", async () => {
  await withEnv({
    AI_PROVIDER_PRIORITY: "groq,openrouter",
    GEMINI_API_KEY: undefined,
    GROQ_API_KEY: "test-groq-key",
    OPENROUTER_API_KEY: "test-openrouter-key",
  }, async () => {
    const originalFetch = globalThis.fetch;
    const endpoints: string[] = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      endpoints.push(url);
      if (url.includes("groq.com")) return new Response(JSON.stringify({ error: { message: "temporary failure" } }), { status: 503 });
      return new Response(JSON.stringify({ choices: [{ message: { content: "Fallback response" } }] }), { status: 200 });
    };
    try {
      assert.equal(getPrimaryAIProvider(), "groq");
      assert.equal(await generateTextWithFallback("test prompt"), "Fallback response");
      assert.equal(endpoints.length, 2);
      assert.match(endpoints[0], /api\.groq\.com/);
      assert.match(endpoints[1], /openrouter\.ai/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("reports a bounded AI-provider error when every configured provider fails", async () => {
  await withEnv({
    AI_PROVIDER_PRIORITY: "groq",
    GEMINI_API_KEY: undefined,
    GROQ_API_KEY: "test-groq-key",
    OPENROUTER_API_KEY: undefined,
  }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 });
    try {
      await assert.rejects(generateTextWithFallback("test prompt"), (error: unknown) => error instanceof AIProviderError && error.status === 429);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
