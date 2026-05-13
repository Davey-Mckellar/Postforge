const RETRIABLE = new Set([502, 503, 504]);

/**
 * Retries transient server errors a few times with backoff (chat / agent / schrodinger).
 */
export async function fetchChatWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  opts?: { retries?: number },
): Promise<Response> {
  const retries = opts?.retries ?? 2;
  let last: Response | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (init.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    last = await fetch(input, {
      ...init,
      credentials: init.credentials ?? "include",
    });
    if (!RETRIABLE.has(last.status) || attempt === retries) {
      return last;
    }
    await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
  }
  return last!;
}

export function formatChatError(status: number, bodyError?: string): string {
  if (status === 429) {
    return bodyError ?? "Rate limit hit — the free API quota is exhausted. Switch models or try again in a minute.";
  }
  if (status === 503) {
    if (bodyError?.toLowerCase().includes("no llm") || bodyError?.toLowerCase().includes("configured")) {
      return "LLM not configured — add Z_AI_API_KEY or OPENAI_API_KEY (see .env.local.example).";
    }
    return bodyError ?? "Service unavailable (503). Check API keys and provider status.";
  }
  if (status === 502) {
    return bodyError ?? "Bad gateway (502) — provider error. Try again in a moment.";
  }
  if (status === 401) {
    return bodyError ?? "Unauthorized — sign in or use a valid API token.";
  }
  if (status === 402) {
    return bodyError ?? "Not enough credits (server wallet). Open Plans or wait for monthly accrual.";
  }
  if (status === 403) {
    return bodyError ?? "This model or mode is not included on your plan.";
  }
  return bodyError ?? `Request failed (${status})`;
}
