/**
 * Anthropic Claude API integration for bbGPT.
 * Uses the raw HTTP API (no SDK required) so the bundle stays clean.
 * Converts Anthropic SSE → OpenAI-compatible SSE so the existing client parser
 * (stream-parse.ts) works with zero changes on the frontend.
 *
 * Prompt caching strategy:
 *   Anthropic's cache_control is only valid on:
 *     - system content blocks
 *     - user message content blocks
 *     - tool result blocks
 *   Assistant blocks are NOT supported — applying cache_control there
 *   will cause 400 errors or silent cache misses.
 *
 *   We apply two breakpoints:
 *   1. System block (always) — caches the static base instructions.
 *      Dynamic content (memory, skills, DNA) is deliberately kept in a
 *      SEPARATE un-cached user message so it doesn't bust the static cache.
 *   2. Midpoint user turn in long conversations (≥ 6 turns) — finds the
 *      nearest USER turn at or before the midpoint, never an assistant turn.
 *
 *   Cache TTL: 5 minutes (Anthropic ephemeral). Cache key = exact bytes.
 *
 * Supported models:
 *   claude-haiku   → claude-haiku-4-5-20251001
 *   claude-sonnet  → claude-sonnet-4-6
 *   claude-opus    → claude-opus-4-6
 */

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const CACHE_BETA = "prompt-caching-2024-07-31";
const THINKING_BETA = "interleaved-thinking-2025-05-14";

/**
 * Static identity sent on every Claude request.
 * This text is IDENTICAL across all requests, so it reliably hits Anthropic's
 * 5-minute prompt cache. Dynamic content (memory, skills, quantum) is sent
 * in a separate un-cached system block so it never busts this cached prefix.
 */
const BBGPT_STATIC_SYSTEM =
  "You are bbGPT, a capable AI assistant. Be direct, accurate, and helpful. " +
  "When the user provides memory or context blocks below, honor them precisely.";

/** Map bbGPT tier names → actual Anthropic model IDs */
export const CLAUDE_MODEL_MAP: Record<string, string> = {
  "claude-haiku":  "claude-haiku-4-5-20251001",
  "claude-sonnet": "claude-sonnet-4-6",
  "claude-opus":   "claude-opus-4-6",
};

export function getAnthropicApiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY?.trim() || null;
}

export function isClaudeTier(model: string): boolean {
  return model.startsWith("claude-");
}

type TextBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };
type ContentBlock = TextBlock;

/**
 * Convert bbGPT/OpenAI-style messages to Anthropic format.
 *
 * Cache design:
 *   - System messages are joined and sent as a single cached content block.
 *     This is the static portion — only cache-busts when instructions change.
 *   - Dynamic context (memory, skills) arrives as a prefixed system message
 *     from the route layer and is placed LAST in the system block, also cached.
 *     Because the system block is only ~100-500 tokens for static instructions,
 *     the cache hit rate is high as long as we don't mutate the static text.
 *   - For long conversations, we find the nearest user turn at or before the
 *     midpoint and apply a second cache breakpoint there. This caches the
 *     shared prefix of the conversation history on the Anthropic side.
 *     IMPORTANT: we only mark USER turns — assistant blocks are not supported
 *     by Anthropic's prompt-caching API and will cause 400 errors if marked.
 */
function splitMessages(
  messages: { role: string; content: string }[],
  enableCaching = true,
): {
  system: ContentBlock[];
  messages: { role: "user" | "assistant"; content: string | ContentBlock[] }[];
} {
  const systemText = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  // Two system blocks:
  //   1. Static identity — always identical, reliably hits the 5-min cache.
  //   2. Dynamic context (memory, skills, quantum) — changes per-request, not cached.
  // Separating them ensures the static block cache is never busted by dynamic content.
  const systemBlocks: ContentBlock[] = [
    {
      type: "text",
      text: BBGPT_STATIC_SYSTEM,
      ...(enableCaching ? { cache_control: { type: "ephemeral" } } : {}),
    },
    ...(systemText ? [{ type: "text" as const, text: systemText }] : []),
  ];

  // Build alternating user/assistant turns.
  const turns: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    const role = m.role === "assistant" ? "assistant" : "user";
    const last = turns[turns.length - 1];
    if (last && last.role === role) {
      last.content += "\n\n" + m.content;
    } else {
      turns.push({ role, content: m.content });
    }
  }

  if (turns.length && turns[0].role === "assistant") {
    turns.unshift({ role: "user", content: "(continuing)" });
  }
  if (turns.length && turns[turns.length - 1].role === "assistant") {
    turns.push({ role: "user", content: "Please continue." });
  }

  if (!turns.length) {
    return { system: systemBlocks, messages: [{ role: "user", content: "Hello" }] };
  }

  // Find the midpoint cache index: the nearest USER turn AT OR BEFORE the
  // mathematical midpoint of the conversation. Never mark an assistant turn.
  // Only applied when there are enough turns to make caching worthwhile.
  let midpointCacheIndex = -1;
  if (enableCaching && turns.length >= 6) {
    const mid = Math.floor(turns.length / 2);
    // Walk backwards from midpoint to find the nearest user turn
    for (let i = mid; i >= 0; i--) {
      if (turns[i]?.role === "user") {
        // Don't cache the final user turn — that's the live question
        if (i < turns.length - 1) {
          midpointCacheIndex = i;
        }
        break;
      }
    }
  }

  const formatted: { role: "user" | "assistant"; content: string | ContentBlock[] }[] = turns.map(
    (t, i) => {
      if (i === midpointCacheIndex) {
        return {
          role: "user" as const,
          content: [{ type: "text" as const, text: t.content, cache_control: { type: "ephemeral" as const } }],
        };
      }
      return { role: t.role, content: t.content };
    },
  );

  return { system: systemBlocks, messages: formatted };
}

export async function streamClaudeChat(opts: {
  apiKey: string;
  model: string;
  messages: { role: string; content: string }[];
  thinking?: boolean;
}): Promise<ReadableStream<Uint8Array>> {
  const claudeModel = CLAUDE_MODEL_MAP[opts.model] ?? CLAUDE_MODEL_MAP["claude-sonnet"];
  const { system, messages } = splitMessages(opts.messages, true);

  const thinkingParam =
    opts.thinking && opts.model !== "claude-haiku"
      ? { thinking: { type: "enabled", budget_tokens: 8000 } }
      : {};

  const betaHeaders = [CACHE_BETA, ...(opts.thinking ? [THINKING_BETA] : [])].join(",");

  const body: Record<string, unknown> = {
    model: claudeModel,
    max_tokens: opts.thinking ? 16000 : 8192,
    stream: true,
    messages,
    ...thinkingParam,
  };
  if (system.length) body.system = system;

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
      "anthropic-beta": betaHeaders,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error("Anthropic API error " + res.status + ": " + t.slice(0, 800));
  }

  if (!res.body) throw new Error("Anthropic returned empty body");

  const enc = new TextEncoder();
  const src = res.body;

  const transform = new TransformStream({
    async transform(chunk, ctrl) {
      const text = new TextDecoder().decode(chunk);
      const lines = text.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line.startsWith("data:")) continue;

        const payload = line.slice(5).trim();
        if (!payload) continue;

        let parsed;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }

        const type = parsed.type;

        if (type === "content_block_delta") {
          const delta = parsed.delta;
          if (!delta) continue;
          if (delta.type === "text_delta") {
            const sse = "data: " + JSON.stringify({ choices: [{ delta: { content: delta.text ?? "" } }] }) + "\n\n";
            ctrl.enqueue(enc.encode(sse));
          } else if (delta.type === "thinking_delta") {
            const sse = "data: " + JSON.stringify({ choices: [{ delta: { reasoning_content: delta.thinking ?? "" } }] }) + "\n\n";
            ctrl.enqueue(enc.encode(sse));
          }
        } else if (type === "message_stop") {
          ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
        } else if (type === "error") {
          throw new Error(parsed.error?.message ?? "Unknown Anthropic error");
        }
      }
    },
  });

  return src.pipeThrough(transform);
}

export async function claudeChatCompletionJson(opts: {
  apiKey: string;
  model: string;
  messages: { role: string; content: string }[];
}): Promise<string> {
  const claudeModel = CLAUDE_MODEL_MAP[opts.model] ?? CLAUDE_MODEL_MAP["claude-sonnet"];
  const { system, messages } = splitMessages(opts.messages, true);

  const body: Record<string, unknown> = {
    model: claudeModel,
    max_tokens: 4096,
    stream: false,
    messages,
  };
  if (system.length) body.system = system;

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
      "anthropic-beta": CACHE_BETA,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error("Anthropic API error " + res.status + ": " + t.slice(0, 800));
  }

  const data = await res.json() as {
    content?: { type: string; text?: string }[];
  };

  return data.content
    ?.filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("") ?? "";
}
