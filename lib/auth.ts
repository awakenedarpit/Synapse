import "server-only";

/**
 * Public demo mode: Clerk is intentionally bypassed so the prototype can be
 * tested without an account. All visitors share the demo workspace.
 *
 * Do not use this mode for private or production user data.
 */
export type AuthenticatedIdentity = { userId: string };
export type AuthFailure = { ok: false; status: 401 | 503; error: string };
export type AuthResult = { ok: true; identity: AuthenticatedIdentity } | AuthFailure;

export async function getAuthenticatedIdentity(): Promise<AuthResult> {
  return { ok: true, identity: { userId: "synapse-demo" } };
}
