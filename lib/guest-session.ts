import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
export const GUEST_SESSION_COOKIE = "synapse_guest_session";
export const GUEST_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const TOKEN_VERSION = 1;
const GUEST_ID_PATTERN = /^guest_[0-9a-f-]{36}$/;

type SessionPayload = { v: number; guestId: string; exp: number };
function secretFromEnv(env: Record<string, string | undefined> = process.env): string | undefined {
  const secret = env.GUEST_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : undefined;
}
function encode(value: string): string { return Buffer.from(value, "utf8").toString("base64url"); }
function decode(value: string): string { return Buffer.from(value, "base64url").toString("utf8"); }
function sign(value: string, secret: string): string { return createHmac("sha256", secret).update(value).digest("base64url"); }

export function hasGuestSessionConfiguration(env: Record<string, string | undefined>): boolean { return Boolean(secretFromEnv(env)); }

export function createGuestSessionToken(now = Math.floor(Date.now() / 1000), secret = secretFromEnv()): { token: string; guestId: string; expiresAt: number } {
  if (!secret) throw new Error("GUEST_SESSION_SECRET must be configured with at least 32 characters.");
  const guestId = `guest_${randomUUID()}`;
  const payload: SessionPayload = { v: TOKEN_VERSION, guestId, exp: now + GUEST_SESSION_TTL_SECONDS };
  const encoded = encode(JSON.stringify(payload));
  return { token: `${encoded}.${sign(encoded, secret)}`, guestId, expiresAt: payload.exp };
}

export function verifyGuestSessionToken(token: string | undefined, now = Math.floor(Date.now() / 1000), secret = secretFromEnv()): string | null {
  if (!secret || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const expected = Buffer.from(sign(parts[0], secret));
    const actual = Buffer.from(parts[1]);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const payload = JSON.parse(decode(parts[0])) as Partial<SessionPayload>;
    if (payload.v !== TOKEN_VERSION || typeof payload.guestId !== "string" || !GUEST_ID_PATTERN.test(payload.guestId) || typeof payload.exp !== "number" || !Number.isSafeInteger(payload.exp) || payload.exp <= now) return null;
    return payload.guestId;
  } catch { return null; }
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const configured = process.env.PUBLIC_APP_URL;
  if (configured) return origin === configured.replace(/\/$/, "");
  const url = new URL(request.url);
  return origin === url.origin;
}

export function guestCookieOptions(expiresAt: number) {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(expiresAt * 1000), maxAge: GUEST_SESSION_TTL_SECONDS };
}

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };
const localBuckets = new Map<string, { count: number; resetAt: number }>();
export async function enforceRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const response = await fetch(`${url}/pipeline`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify([["INCR", key], ["EXPIRE", key, windowSeconds]]) , cache: "no-store" });
      if (!response.ok) throw new Error(`rate limiter returned ${response.status}`);
      const result = await response.json() as Array<{ result?: number }>;
      const count = Number(result[0]?.result || 0);
      return { allowed: count <= limit, retryAfterSeconds: count <= limit ? 0 : windowSeconds };
    } catch (error) { console.error("[RATE LIMIT] Durable limiter unavailable:", error instanceof Error ? error.message : "unknown error"); }
  }
  const now = Date.now();
  const current = localBuckets.get(key);
  if (!current || current.resetAt <= now) { localBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 }); return { allowed: true, retryAfterSeconds: 0 }; }
  current.count += 1;
  return { allowed: current.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}
