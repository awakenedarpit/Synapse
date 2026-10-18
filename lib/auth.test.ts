import assert from "node:assert/strict";
import { test } from "node:test";
import { hasClerkConfiguration } from "./auth-config.ts";

test("fails closed when Clerk is not configured instead of returning a shared demo identity", async () => {
  assert.equal(hasClerkConfiguration({}), false);
  assert.equal(hasClerkConfiguration({ CLERK_SECRET_KEY: "secret" }), false);
  assert.equal(hasClerkConfiguration({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "publishable" }), false);
  assert.equal(hasClerkConfiguration({ CLERK_SECRET_KEY: "secret", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "publishable" }), true);
});
