import assert from "node:assert/strict";
import { test } from "node:test";
import { getChatMemoryPolicy, graphUnavailableGuidance } from "./chat-policy.ts";

test("general knowledge does not require graph context or durable memory", () => {
  assert.deepEqual(getChatMemoryPolicy("What is artificial intelligence?"), { needsGraphContext: false, persistMemory: false });
  assert.match(graphUnavailableGuidance(false), /general question directly/i);
});

test("personal-memory questions request scoped graph evidence without saving the question", () => {
  assert.deepEqual(getChatMemoryPolicy("What do you remember about my project?"), { needsGraphContext: true, persistMemory: false });
  assert.deepEqual(getChatMemoryPolicy("Do you remember my favorite programming language?"), { needsGraphContext: true, persistMemory: false });
  assert.deepEqual(getChatMemoryPolicy("What is my favorite programming language?"), { needsGraphContext: true, persistMemory: false });
  assert.deepEqual(getChatMemoryPolicy("Forget this memory about my old project."), { needsGraphContext: true, persistMemory: false });
  assert.match(graphUnavailableGuidance(true), /do not claim to remember/i);
});

test("explicit requests and direct personal fact statements are persisted", () => {
  assert.deepEqual(getChatMemoryPolicy("Remember that my favorite programming language is Python."), { needsGraphContext: true, persistMemory: true });
  assert.deepEqual(getChatMemoryPolicy("My favorite programming language is Python."), { needsGraphContext: true, persistMemory: true });
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
