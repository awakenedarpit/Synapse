import assert from "node:assert/strict";
import { test } from "node:test";
import { getChatMemoryPolicy, graphUnavailableGuidance } from "./chat-policy.ts";

test("general knowledge does not require graph context or durable memory", () => {
  assert.deepEqual(getChatMemoryPolicy("What is artificial intelligence?"), { needsGraphContext: false, persistMemory: false });
  assert.match(graphUnavailableGuidance(false), /general question directly/i);
});

test("personal-memory questions request scoped graph evidence and persistence", () => {
  assert.deepEqual(getChatMemoryPolicy("What do you remember about my project?"), { needsGraphContext: true, persistMemory: true });
  assert.match(graphUnavailableGuidance(true), /do not claim to remember/i);
});

test("explicitly stating a name triggers graph memory persistence", () => {
  for (const message of ["My name is Arpit", "Please call me Arpit", "I go by Arpit"]) {
    assert.deepEqual(getChatMemoryPolicy(message), { needsGraphContext: true, persistMemory: true });
  }
});

test("attachments are persisted as document memories, while ordinary conversation is not", () => {
  assert.equal(getChatMemoryPolicy("Summarize this file", true).persistMemory, true);
  assert.equal(getChatMemoryPolicy("Tell me a joke").persistMemory, false);
});
