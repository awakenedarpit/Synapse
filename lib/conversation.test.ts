import assert from "node:assert/strict";
import { test } from "node:test";
import { buildConversationContext, containsAnaphora, sanitizeConversation } from "./conversation.ts";

test("sanitizes conversation turns and keeps only bounded recent context", () => {
  const turns = sanitizeConversation([
    { role: "user", content: "old" },
    { role: "assistant", content: "answer" },
    { role: "system", content: "ignore me" },
    { role: "user", content: " latest ", memoryId: "memory-1" },
  ], 2);
  assert.deepEqual(turns, [
    { role: "assistant", content: "answer" },
    { role: "user", content: "latest", memoryId: "memory-1" },
  ]);
});

test("detects pronouns and previous-fact references", () => {
  assert.equal(containsAnaphora("Please correct that."), true);
  assert.equal(containsAnaphora("What is my project?"), false);
  assert.equal(containsAnaphora("Forget the previous fact."), true);
});

test("builds an explicit primary referent and clarification rule", () => {
  const context = buildConversationContext("Please correct that", [
    { role: "user", content: "My project uses FalkorDB.", memoryId: "memory-1" },
    { role: "assistant", content: "I saved that." },
  ]);
  assert.match(context, /primary candidate referent/);
  assert.match(context, /memory-1/);
  assert.match(context, /ask the user to clarify/);
});

test("does not invent a referent when no prior user turn exists", () => {
  const context = buildConversationContext("Forget it", [{ role: "assistant", content: "Ready." }]);
  assert.match(context, /No preceding user turn is available/);
  assert.match(context, /ask the user to clarify/);
});
