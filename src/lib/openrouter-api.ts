/**
 * OpenRouter API integration for bbGPT.
 *
 * OpenRouter provides Claude (and other models) via an OpenAI-compatible API.
 * Used as a fallback when ANTHROPIC_API_KEY has no credits, or as primary path
 * when OPENROUTER_API_KEY is set and ANTHROPIC_API_KEY is not.
 *
 * Two model tiers:
 *   Paid models (OPENROUTER_API_KEY with balance): Claude 3.5/3.7 — highest quality
 *   Free models (:free suffix): Llama 4 Maverick/Scout — zero cost, no credit card
 *
 * Fund at: https://openrouter.ai -- $5 covers thousands of Haiku messages.
 * API keys: https://openrouter.ai/keys
 */

const OPENROUTER_CHAT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Paid Claude models via OpenRouter — used when balance is available.
 */
export const OPENROUTER_CLAUDE_MODEL_MAP: Record<string, string> = {
  "claude-haiku":  "anthropic/claude-3-5-haiku-20241022",
  "claude-sonnet": "anthropic/claude-3-7-sonnet-20250219",
  "claude-opus":   "anthropic/claude-3-opus-20240229",
};

/**
 * Free Llama 4 models via OpenRouter — zero cost, no balance required.
 * The :free suffix routes to OpenRouter's free tier for these models.
 */
export const OPENROUTER_FREE_MODEL_MAP: Record<string, string> = {
  "claude-haiku":  "meta-llama/llama-4-scout:free",
  "claude-sonnet": "meta-llama/llama-4-maverick:free",
  "claude-opus":   "meta-llama/llama-4-maverick:free",
};

export function getOpenRouterApiKey(): string | null {
  return process.env.OPENROUTER_API_KEY?.trim() || null;
}

/**
 * Stream via OpenRouter using free Llama 4 models (:free tier).
 * No credit card or balance required — just a free OpenRouter API key.
 */
export async function streamOpenRouterFreeChat(opts: {
  apiKey: string;
  model: string;
  messages: { role: string; content: string }[];
}): Promise<ReadableStream<Uint8Array>> {
  const freeModel =
    OPENROUTER_FREE_MODEL_MAP[opts.model] ??
    OPENROUTER_FREE_MODEL_MAP["claude-sonnet"];

  const res = await fetch(OPENROUTER_CHAT, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + opts.apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://www.bbgpt.ai",
      "X-Title": "bbGPT",
    },
    body: JSON.stringify({
      model: freeModel,
      messages: opts.messages,
      stream: true,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error("OpenRouter free API error " + res.status + ": " + t.slice(0, 800));
  }

  if (!res.body) throw new Error("OpenRouter returned empty body");
  return res.body;
}

/**
 * Stream a Claude completion via OpenRouter.
 * Returns a ReadableStream<Uint8Array> emitting OpenAI-compatible SSE --
 * the existing client parser works with zero changes.
 */
export async function streamOpenRouterChat(opts: {
  apiKey: string;
  model: string; // bbGPT tier like "claude-sonnet"
  messages: { role: string; content: string }[];
}): Promise<ReadableStream<Uint8Array>> {
  const routerModel =
    OPENROUTER_CLAUDE_MODEL_MAP[opts.model] ??
    OPENROUTER_CLAUDE_MODEL_MAP["claude-sonnet"];

  const res = await fetch(OPENROUTER_CHAT, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + opts.apiKey,
      "Content-Type": "application/json",
      // OpenRouter attribution headers (optional but good practice)
      "HTTP-Referer": "https://www.bbgpt.ai",
      "X-Title": "bbGPT",
    },
    body: JSON.stringify({
      model: routerModel,
      messages: opts.messages,
      stream: true,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error("OpenRouter API error " + res.status + ": " + t.slice(0, 800));
  }

  if (!res.body) throw new Error("OpenRouter returned empty body");

  // OpenRouter already emits OpenAI-compatible SSE -- pass through unchanged
  return res.body;
}

/**
 * Non-streaming Claude completion via OpenRouter -- used in agent loop planner.
 */
export async function openRouterChatCompletionJson(opts: {
  apiKey: string;
  model: string;
  messages: { role: string; content: string }[];
}): Promise<string> {
  const routerModel =
    OPENROUTER_CLAUDE_MODEL_MAP[opts.model] ??
    OPENROUTER_CLAUDE_MODEL_MAP["claude-sonnet"];

  const res = await fetch(OPENROUTER_CHAT, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + opts.apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://www.bbgpt.ai",
      "X-Title": "bbGPT",
    },
    body: JSON.stringify({
      model: routerModel,
      messages: opts.messages,
      stream: false,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error("OpenRouter API error " + res.status + ": " + t.slice(0, 800));
  }

  const data = await res.json();

  return data.choices?.[0]?.message?.content ?? "";
}