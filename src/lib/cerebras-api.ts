/**
 * Cerebras API integration for bbGPT.
 *
 * Cerebras runs Llama on custom AI chips — faster than Groq and with a larger
 * free tier: 1 million tokens per day, 60 RPM, completely free with no credit card.
 * API is OpenAI-compatible so the response format works with the existing client parser.
 *
 * Free tier: 1M TPD, 60 RPM
 * Sign up: https://cloud.cerebras.ai
 * Env var: CEREBRAS_API_KEY
 *
 * Model routing: Claude tier names map to the best available Cerebras models.
 *   haiku  → llama-4-scout-17b-16e-instruct (fast, lightweight)
 *   sonnet → llama3.3-70b                   (balanced)
 *   opus   → llama3.3-70b                   (best available on Cerebras)
 */

const CEREBRAS_CHAT = "https://api.cerebras.ai/v1/chat/completions";

export const CEREBRAS_MODEL_MAP: Record<string, string> = {
  "claude-haiku":  "llama-4-scout-17b-16e-instruct",
  "claude-sonnet": "llama3.3-70b",
  "claude-opus":   "llama3.3-70b",
};

export function getCerebrasApiKey(): string | null {
  return process.env.CEREBRAS_API_KEY?.trim() || null;
}

export async function streamCerebrasChat(opts: {
  apiKey: string;
  model: string;
  messages: { role: string; content: string }[];
}): Promise<ReadableStream<Uint8Array>> {
  const cerebrasModel =
    CEREBRAS_MODEL_MAP[opts.model] ?? CEREBRAS_MODEL_MAP["claude-sonnet"];

  const res = await fetch(CEREBRAS_CHAT, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + opts.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cerebrasModel,
      messages: opts.messages,
      stream: true,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error("Cerebras API error " + res.status + ": " + t.slice(0, 800));
  }

  if (!res.body) throw new Error("Cerebras returned empty body");

  // Cerebras emits OpenAI-compatible SSE — pass through unchanged
  return res.body;
}

export async function cerebrasChatCompletionJson(opts: {
  apiKey: string;
  model: string;
  messages: { role: string; content: string }[];
}): Promise<string> {
  const cerebrasModel =
    CEREBRAS_MODEL_MAP[opts.model] ?? CEREBRAS_MODEL_MAP["claude-sonnet"];

  const res = await fetch(CEREBRAS_CHAT, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + opts.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cerebrasModel,
      messages: opts.messages,
      stream: false,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error("Cerebras API error " + res.status + ": " + t.slice(0, 800));
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}
