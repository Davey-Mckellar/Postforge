/**
 * Anthropic Claude API integration for bbGPT.
 * Uses the raw HTTP API (no SDK required) so the bundle stays clean.
 * Converts Anthropic SSE → OpenAI-compatible SSE so the existing client parser
 * (stream-parse.ts) works with zero changes on the frontend.
 *
 * Supported models:
 *   claude-haiku   → claude-haiku-4-5-20251001   (fast, 1 cr)
 *   claude-sonnet  → claude-sonnet-4-6            (balanced, 5 cr)
 *   claude-opus    → claude-opus-4-6              (flagship, 10 cr)
 */

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

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

/**
 * Convert bbGPT/OpenAI-style messages to Anthropic format.
 * Anthropic requires system as a top-level param; user/assistant alternate.
 */
function splitMessages(
  messages: { role: string; content: string }[],
): {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
} {
  const systemParts = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  // Anthropic requires alternating user/assistant, starting with user.
  // Merge consecutive same-role messages.
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

  // Must start with user turn
  if (turns.length && turns[0].role === "assistant") {
    turns.unshift({ role: "user", content: "(continuing)" });
  }

  // Must end with user turn (Anthropic requirement)
  if (turns.length && turns[turns.length - 1].role === "assistant") {
    turns.push({ role: "user", content: "Please continue." });
  }

  return {
    system: systemParts,
    messages: turns.length ? turns : [{ role: "user", content: "Hello" }],
  };
}

/**
 * Stream a Claude completion and return a ReadableStream<Uint8Array> that
 * emits OpenAI-compatible SSE lines. The existing extractSseTextDelta and
 * extractSseThinkingDelta parsers on the client will work unchanged.
 *
 * Anthropic SSE events we handle:
 *   content_block_delta (text_delta)  → choices[0].delta.content
 *   content_block_delta (thinking)    → choices[0].delta.reasoning_content
 *   message_stop                      → [DONE]
 */
export async function streamClaudeChat(opts: {
  apiKey: string;
  model: string; // bbGPT tier like "claude-sonnet"
  messages: { role: string; content: string }[];
  thinking?: boolean;
}): Promise<ReadableStream<Uint8Array>> {
  const claudeModel = CLAUDE_MODEL_MAP[opts.model] ?? CLAUDE_MODEL_MAP["claude-sonnet"];
  const { system, messages } = splitMessages(opts.messages);

  // Extended thinking is supported on Sonnet and Opus
  const thinkingParam =
    opts.thinking && opts.model !== "claude-haiku"
      ? { thinking: { type: "enabled", budget_tokens: 8000 } }
      : {};

  const body: Record<string, unknown> = {
    model: claudeModel,
    max_tokens: opts.thinking ? 16000 : 8192,
    stream: true,
    messages,
    ...thinkingParam,
  };
  if (system) body.system = system;

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
      // Required for extended thinking
      "anthropic-beta": "interleaved-thinking-2025-05-14",
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

  // Transform Anthropic SSE → OpenAI-compatible SSE
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

          const deltaType = delta.type;

          if (deltaType === "text_delta") {
            const text = delta.text ?? "";
            const sse = "data: " + JSON.stringify({ choices: [{ delta: { content: text } }] }) + "\n\n";
            ctrl.enqueue(enc.encode(sse));
          } else if (deltaType === "thinking_delta") {
            const thinking = delta.thinking ?? "";
            const sse = "data: " + JSON.stringify({ choices: [{ delta: { reasoning_content: thinking } }] }) + "\n\n";
            ctrl.enqueue(enc.encode(sse));
          }
        } else if (type === "message_stop") {
          ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
        } else if (type === "error") {
          const msg = parsed.error?.message ?? "Unknown Anthropic error";
          throw new Error(msg);
        }
      }
    },
  });

  return src.pipeThrough(transform);
}

/**
 * Non-streaming Claude completion — used in agent loop planner steps.
 */
export async function claudeChatCompletionJson(opts: {
  apiKey: string;
  model: string;
  messages: { role: string; content: string }[];
}): Promise<string> {
  const claudeModel = CLAUDE_MODEL_MAP[opts.model] ?? CLAUDE_MODEL_MAP["claude-sonnet"];
  const { system, messages } = splitMessages(opts.messages);

  const body: Record<string, unknown> = {
    model: claudeModel,
    max_tokens: 4096,
    stream: false,
    messages,
  };
  if (system) body.system = system;

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
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