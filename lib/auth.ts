import "server-only";
import { auth } from "@clerk/nextjs/server";

export type AuthenticatedIdentity = { userId: string };
export type AuthFailure = { ok: false; status: 401 | 503; error: string };
export type AuthResult = { ok: true; identity: AuthenticatedIdentity } | AuthFailure;

function authConfigured(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}

/** Resolve the canonical identity from Clerk's verified server session.
 * Request-body, query-string, and client-local profile values are intentionally ignored.
 */
export async function getAuthenticatedIdentity(): Promise<AuthResult> {
  if (!authConfigured()) {
    return { ok: false, status: 503, error: "Authentication is not configured. Set the Clerk server and publishable keys." };
  }
  try {
    const { userId } = await auth();
    if (!userId || !/^user_[A-Za-z0-9_-]{1,120}$/.test(userId)) {
      return { ok: false, status: 401, error: "Sign in to access this Synapse workspace." };
    }
    return { ok: true, identity: { userId } };
  } catch (error) {
    console.error("[AUTH] Session verification failed:", error instanceof Error ? error.message : "unknown error");
    return { ok: false, status: 503, error: "Authentication could not be verified. Try again shortly." };
  }
}
