export type ConversationRole = "user" | "assistant";

export type ConversationTurn = {
  role: ConversationRole;
  content: string;
  memoryId?: string;
};

const ANAPHORA_PATTERN = /\b(it|that|this|they|them|those|the previous (?:fact|message|memory)|the last one)\b/i;

export function sanitizeConversation(value: unknown, maxTurns = 8): ConversationTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((turn): turn is { role?: unknown; content?: unknown; memoryId?: unknown } => Boolean(turn) && typeof turn === "object")
    .map((turn) => {
      const role = turn.role === "assistant" ? "assistant" : turn.role === "user" ? "user" : null;
      const content = typeof turn.content === "string" ? turn.content.trim().slice(0, 2000) : "";
      const memoryId = typeof turn.memoryId === "string" && turn.memoryId.trim().length <= 200 ? turn.memoryId.trim() : "";
      return memoryId ? { role, content, memoryId } : { role, content };
    })
    .filter((turn): turn is ConversationTurn => Boolean(turn.role && turn.content))
    .slice(-Math.max(1, Math.min(maxTurns, 20)));
}

export function containsAnaphora(message: string): boolean {
  return ANAPHORA_PATTERN.test(message);
}

export function buildConversationContext(message: string, turns: ConversationTurn[]): string {
  if (!turns.length) return "No prior conversation turns were supplied.";
  const transcript = turns.map((turn, index) => {
    const target = turn.memoryId ? ` [memoryId: ${turn.memoryId}]` : "";
    return `${index + 1}. ${turn.role.toUpperCase()}${target}: ${turn.content}`;
  }).join("\n");
  if (!containsAnaphora(message)) return `Recent conversation (quoted user-provided context):\n${transcript}`;

  const previousUser = [...turns].reverse().find((turn) => turn.role === "user");
  const referent = previousUser ? `The immediately preceding user turn is the primary candidate referent${previousUser.memoryId ? ` (memoryId ${previousUser.memoryId})` : ""}: "${previousUser.content}"` : "No preceding user turn is available as a referent.";
  return [
    "The current message contains a pronoun or implicit reference.",
    referent,
    "Resolve it only when that preceding turn is the single clear referent. If more than one fact could match, ask the user to clarify instead of guessing.",
    "Recent conversation (quoted user-provided context):",
    transcript,
  ].join("\n");
}
