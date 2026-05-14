/**
 * Context window trimming — keeps token costs bounded on long conversations.
 *
 * Strategy: anchor + tail (better coherence than drop-from-middle)
 *   1. Always keep system messages verbatim — they're the identity/instructions.
 *   2. Keep the first ANCHOR_TURNS non-system turns (task setup, key decisions).
 *   3. Keep the last TAIL_TURNS non-system turns (current exchange).
 *   4. Drop everything in between when total chars exceed the budget.
 *   5. Inject a USER-role stub (not system) so it appears inline in the
 *      conversation rather than polluting the cached system block.
 *
 * Why anchor + tail beats drop-from-middle:
 *   The first 2 exchanges usually contain the task definition, constraints,
 *   and any key decisions. Dropping those first causes the worst coherence
 *   failures. The last 12 turns contain the live working context.
 *
 * Why the stub is role:"user" not role:"system":
 *   Placing a stub in the system role merges it into the Anthropic system block,
 *   busting the prompt cache on every different trim count. A user-role stub
 *   sits in the conversation and doesn't affect the cached system prefix.
 *
 * Char budget: 60k chars ≈ 12-20k tokens depending on content.
 * For code-heavy conversations (≈ 2 chars/token) this is ~30k tokens —
 * well within context windows. For prose (≈ 4 chars/token) it's ~15k tokens.
 * Both are safe for all supported models.
 */

export const CONTEXT_CHAR_BUDGET = 60_000;
export const CONTEXT_ANCHOR_TURNS = 4;  // first N non-system turns always kept
export const CONTEXT_TAIL_TURNS = 12;   // last N non-system turns always kept

type Msg = { role: "user" | "assistant" | "system"; content: string };

function charCount(msgs: Msg[]): number {
  return msgs.reduce((n, m) => n + m.content.length, 0);
}

/**
 * Trim `messages` so total character count stays within `budget`.
 * Returns a new array — never mutates the input.
 */
export function trimContext(
  messages: Msg[],
  budget = CONTEXT_CHAR_BUDGET,
  anchorTurns = CONTEXT_ANCHOR_TURNS,
  tailTurns = CONTEXT_TAIL_TURNS,
): Msg[] {
  if (charCount(messages) <= budget) return messages;

  const system = messages.filter((m) => m.role === "system");
  const conv = messages.filter((m) => m.role !== "system");

  // Can't trim below anchor + tail — return as-is if already minimal
  if (conv.length <= anchorTurns + tailTurns) return messages;

  const anchor = conv.slice(0, anchorTurns);
  const tail = conv.slice(-tailTurns);
  let middle = conv.slice(anchorTurns, conv.length - tailTurns);

  // Drop from oldest end of middle until we fit
  while (middle.length > 0 && charCount([...system, ...anchor, ...middle, ...tail]) > budget) {
    middle = middle.slice(1);
  }

  const dropped = conv.length - anchor.length - middle.length - tail.length;

  if (dropped <= 0) return messages;

  // Stub goes as a user turn so it appears in the conversation context without
  // polluting the system block (which is cached by Anthropic and must stay stable).
  const stub: Msg = {
    role: "user",
    content: `[Note: ${dropped} earlier message${dropped === 1 ? "" : "s"} were summarized away to fit the context window. The task setup and recent exchanges are preserved.]`,
  };

  return [...system, ...anchor, stub, ...middle, ...tail];
}
