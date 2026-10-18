import "server-only";
import { cookies } from "next/headers";
import { GUEST_SESSION_COOKIE, hasGuestSessionConfiguration, verifyGuestSessionToken } from "@/lib/guest-session";

export type AuthenticatedIdentity = { userId: string };
export type AuthFailure = { ok: false; status: 401 | 503; error: string };
export type AuthResult = { ok: true; identity: AuthenticatedIdentity } | AuthFailure;

export async function getAuthenticatedIdentity(request: Request): Promise<AuthResult> {
  void request;
  if (!hasGuestSessionConfiguration(process.env)) return { ok: false, status: 503, error: "Guest sessions are not configured. Set GUEST_SESSION_SECRET on the server." };
  const token = (await cookies()).get(GUEST_SESSION_COOKIE)?.value;
  const guestId = verifyGuestSessionToken(token);
  if (!guestId) return { ok: false, status: 401, error: "Your guest session is missing or expired. Refresh the page to start a new session." };
  return { ok: true, identity: { userId: guestId } };
}
