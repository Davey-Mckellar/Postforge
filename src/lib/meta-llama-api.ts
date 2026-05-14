/**
 * Meta Llama API integration for bbGPT.
 *
 * Meta's official Llama API gives direct access to Llama 4 Maverick and Scout —
 * currently in invite-only preview. When the waitlist invite arrives, set the key
 * and these models will automatically slot into the fallback chain.
 *
 * Status: waitlist — invite pending as of 2026-05-14
 * Env var: META_LLAMA_API_KEY
 * Sign up: https://llama.developer.meta.com
 *
 * Model routing:
 *   haiku  → Llama-4-Scout-17B-16E-Instruct   (fast, efficient)
 *   sonnet → Llama-4-Maverick-17B-128E-Instruct-FP8 (balanced, strong)
 *   opus   → Llama-4-Maverick-17B-128E-Instruct-FP8 (best available)
 */

const META_LLAMA_CHAT = "https://api.llama.com/v1/chat/completions";

export const META_LLAMA_MODEL_MAP: Record<string, string> = {
  "claude-haiku":  "Llama-4-Scout-17B-16E-Instruct",
  "claude-sonnet": "Llama-4-Maverick-17B-128E-Instruct-FP8",
  "claude-opus":   "Llama-4-Maverick-17B-128E-Instruct-FP8",
};

export function getMetaLlamaApiKey(): string | null {
  return process.env.META_LLAMA_API_KEY?.trim() || null;
}

export async function streamMetaLlamaChat(opts: {
  apiKey: string;
  model: string;
  messages: { role: string; content: string }[];
}): Promise<ReadableStream<Uint8Array>> {
  const llamaModel =
    META_LLAMA_MODEL_MAP[opts.model] ?? META_LLAMA_MODEL_MAP["claude-sonnet"];

  const res = await fetch(META_LLAMA_CHAT, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + opts.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: llamaModel,
      messages: opts.messages,
      stream: true,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error("Meta Llama API error " + res.status + ": " + t.slice(0, 800));
  }

  if (!res.body) throw new Error("Meta Llama API returned empty body");

  // Meta Llama API is OpenAI-compatible — pass through unchanged
  return res.body;
}

export async function metaLlamaChatCompletionJson(opts: {
  apiKey: string;
  model: string;
  messages: { role: string; content: string }[];
}): Promise<string> {
  const llamaModel =
    META_LLAMA_MODEL_MAP[opts.model] ?? META_LLAMA_MODEL_MAP["claude-sonnet"];

  const res = await fetch(META_LLAMA_CHAT, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + opts.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: llamaModel,
      messages: opts.messages,
      stream: false,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error("Meta Llama API error " + res.status + ": " + t.slice(0, 800));
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}
