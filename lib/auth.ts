import "server-only";
import { auth } from "@clerk/nextjs/server";
import { hasClerkConfiguration } from "@/lib/auth-config";

export type AuthenticatedIdentity = { userId: string };
export type AuthFailure = { ok: false; status: 401 | 503; error: string };
export type AuthResult = { ok: true; identity: AuthenticatedIdentity } | AuthFailure;

export async function getAuthenticatedIdentity(): Promise<AuthResult> {
  if (!hasClerkConfiguration(process.env)) {
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
