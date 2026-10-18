import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <main><h1>Sign-in is not configured</h1><p>Set the Clerk publishable and server keys before enabling private memory access.</p></main>;
  }
  return <Suspense fallback={<main aria-busy="true">Loading sign-in…</main>}><SignIn /></Suspense>;
}
