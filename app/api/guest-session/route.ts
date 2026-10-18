import { NextResponse } from "next/server";
import { GUEST_SESSION_COOKIE, createGuestSessionToken, enforceRateLimit, guestCookieOptions, hasGuestSessionConfiguration, isSameOrigin, verifyGuestSessionToken } from "@/lib/guest-session";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!hasGuestSessionConfiguration(process.env)) return NextResponse.json({ error: "Guest sessions are not configured on the server." }, { status: 503 });
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const limiter = await enforceRateLimit(`synapse:guest-session:${forwarded || "unknown"}`, 20, 60 * 60);
  if (!limiter.allowed) return NextResponse.json({ error: "Too many guest-session requests. Try again later." }, { status: 429, headers: { "Retry-After": String(limiter.retryAfterSeconds) } });
  const existing = (await cookies()).get(GUEST_SESSION_COOKIE)?.value;
  const existingGuestId = verifyGuestSessionToken(existing);
  if (existingGuestId) return NextResponse.json({ ok: true, userId: existingGuestId, reused: true }, { headers: { "Cache-Control": "no-store" } });
  const session = createGuestSessionToken();
  const response = NextResponse.json({ ok: true, userId: session.guestId, reused: false }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(GUEST_SESSION_COOKIE, session.token, guestCookieOptions(session.expiresAt));
  return response;
}
