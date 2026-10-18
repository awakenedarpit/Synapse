import assert from "node:assert/strict";
import { test } from "node:test";
import { createGuestSessionToken, hasGuestSessionConfiguration, verifyGuestSessionToken } from "./guest-session.ts";

test("requires a dedicated sufficiently long guest-session secret", () => {
  assert.equal(hasGuestSessionConfiguration({}), false);
  assert.equal(hasGuestSessionConfiguration({ GUEST_SESSION_SECRET: "short" }), false);
  assert.equal(hasGuestSessionConfiguration({ GUEST_SESSION_SECRET: "x".repeat(32) }), true);
});

test("signs and verifies a guest token, rejecting tampering and expiry", () => {
  const secret = "s".repeat(32);
  const session = createGuestSessionToken(1_000, secret);
  assert.match(session.guestId, /^guest_[0-9a-f-]{36}$/);
  assert.equal(verifyGuestSessionToken(session.token, 1_001, secret), session.guestId);
  assert.equal(verifyGuestSessionToken(`${session.token}tampered`, 1_001, secret), null);
  assert.equal(verifyGuestSessionToken(session.token, session.expiresAt, secret), null);
  assert.equal(verifyGuestSessionToken(session.token, 1_001, "d".repeat(32)), null);
});
