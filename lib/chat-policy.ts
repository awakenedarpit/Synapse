export type ChatMemoryPolicy = {
  needsGraphContext: boolean;
  persistMemory: boolean;
};

const PERSONAL_MEMORY_PATTERNS = [
  /\bremember\b/i,
  // Explicit self-identification should be saved even when the user does not say "remember".
  /\bmy name is\s+\S+/i,
  /\bcall me\s+\S+/i,
  /\bi go by\s+\S+/i,
  /\bwhat do you remember\b/i,
  /\bwhat do you know about me\b/i,
  /\bwhat(?:'s| is) my name\b/i,
  /\bwho am i\b/i,
  /\bwhat have i told you about myself\b/i,
  /\bmy (?:[\w-]+\s+){0,3}(?:project|work|team|database|technology|stack|preferences?|goals?|notes?|memories?)\b/i,
  /\b(?:project|team|database|technology|stack)\b.{0,50}\b(?:mine|my|our)\b/i,
  /\b(?:what|which|who|where|when|how)\b.{0,80}\b(?:my|mine|our|ours)\b/i,
  /\b(?:my|our)\b.{0,120}\b(?:is|are|was|were|uses|has|have|likes|prefer|prefers|works|builds|wants)\b/i,
  /^I\s+(?:prefer|like|love|use|work on|am|have)\b/i,
  /\babout me\b/i,
  /\brecall\b/i,
  /\bforget\b/i,
  /\bcorrect\b.*\bmemory\b/i,
  /\b(update|save|store|add)\b.*\b(memory|fact|note)\b/i,
];

const MEMORY_RECALL_QUESTION_PATTERNS = [
  /\bwhat do you remember\b/i,
  /\b(?:do|can|could) you remember\b/i,
  /\bwhat do you know about me\b/i,
  /\bwhat(?:'s| is) my\b/i,
  /\b(?:who|which|where|when|how)\b.{0,80}\b(?:my|mine|our|ours)\b/i,
  /\bwhat have i told you about myself\b/i,
  /^recall\b/i,
];

const MEMORY_WRITE_PATTERNS = [
  /\bremember\b/i,
  /\bmy name is\s+\S+/i,
  /\bcall me\s+\S+/i,
  /\bi go by\s+\S+/i,
  /\b(?:save|store|add|update|correct)\b.*\b(memory|fact|note)\b/i,
  /^(?:my|our)\b.{0,120}\b(?:is|are|was|were|uses|has|have|likes|prefer|prefers|works|builds|wants)\b/i,
  /^I\s+(?:prefer|like|love|use|work on|am|have)\b/i,
];

export function getChatMemoryPolicy(message: string, hasAttachments = false): ChatMemoryPolicy {
  const normalized = message.trim();
  const personal = PERSONAL_MEMORY_PATTERNS.some((pattern) => pattern.test(normalized));
  const isRecallQuestion = MEMORY_RECALL_QUESTION_PATTERNS.some((pattern) => pattern.test(normalized));
  const writesMemory = MEMORY_WRITE_PATTERNS.some((pattern) => pattern.test(normalized));
  return {
    needsGraphContext: personal,
    persistMemory: hasAttachments || (writesMemory && !isRecallQuestion),
  };
}

export function graphUnavailableGuidance(needsGraphContext: boolean): string {
  return needsGraphContext
    ? "Personal graph memory is unavailable for this request. Do not claim to remember personal facts; clearly say that the memory service could not be reached."
    : "No personal graph memory is needed for this request. Answer the general question directly and do not invent personal memories.";
}
