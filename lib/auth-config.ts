export function hasClerkConfiguration(env: Record<string, string | undefined>): boolean {
  return Boolean(env.CLERK_SECRET_KEY && env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}
