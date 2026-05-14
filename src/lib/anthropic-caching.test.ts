/**
 * Verifies the Anthropic API request body shape produced by anthropic-api.ts.
 * Guards against regressions in caching logic without making real HTTP calls.
 *
 * What we verify:
 *   1. System is an array with ≥1 block (not a plain string).
 *   2. The FIRST system block has cache_control: {type:"ephemeral"} — the static identity.
 *   3. Dynamic context (if present) is a second block WITHOUT cache_control.
 *   4. The beta header includes prompt-caching-2024-07-31.
 *   5. Midpoint cache breakpoint is on a USER turn, never an assistant turn.
 *   6. Short conversations (< 6 turns) have no midpoint breakpoint.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("anthropic prompt caching — request body shape", () => {
  let capturedBody: Record<string, unknown> | null = null;

  beforeEach(() => {
    capturedBody = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
        const enc = new TextEncoder();
        const stream = new ReadableStream({
          start(ctrl) {
            ctrl.enqueue(enc.encode('data: {"type":"message_stop"}\n\n'));
            ctrl.close();
          },
        });
        return new Response(stream, { status: 200 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("system is an array of content blocks (not a plain string)", async () => {
    const { streamClaudeChat } = await import("./anthropic-api");
    await streamClaudeChat({
      apiKey: "test-key",
      model: "claude-sonnet",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(Array.isArray(capturedBody?.system)).toBe(true);
  });

  it("first system block has cache_control: {type:'ephemeral'} — the static identity", async () => {
    const { streamClaudeChat } = await import("./anthropic-api");
    await streamClaudeChat({
      apiKey: "test-key",
      model: "claude-sonnet",
      messages: [{ role: "user", content: "Hello" }],
    });
    const blocks = capturedBody?.system as Array<{ cache_control?: { type: string } }>;
    expect(blocks[0]?.cache_control).toEqual({ type: "ephemeral" });
  });

  it("dynamic system context (second block) has NO cache_control", async () => {
    const { streamClaudeChat } = await import("./anthropic-api");
    await streamClaudeChat({
      apiKey: "test-key",
      model: "claude-sonnet",
      messages: [
        { role: "system", content: "User memory: likes brevity." },
        { role: "user", content: "Hello" },
      ],
    });
    const blocks = capturedBody?.system as Array<{ cache_control?: unknown; text: string }>;
    const dynamicBlock = blocks.find((b) => b.text.includes("User memory"));
    expect(dynamicBlock).toBeDefined();
    expect(dynamicBlock?.cache_control).toBeUndefined();
  });

  it("includes prompt-caching-2024-07-31 in the beta header", async () => {
    const { streamClaudeChat } = await import("./anthropic-api");
    await streamClaudeChat({
      apiKey: "test-key",
      model: "claude-haiku",
      messages: [{ role: "user", content: "Hi" }],
    });
    const headers = vi.mocked(fetch).mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["anthropic-beta"]).toContain("prompt-caching-2024-07-31");
  });

  it("midpoint cache breakpoint is on a USER turn (never assistant)", async () => {
    const { streamClaudeChat } = await import("./anthropic-api");
    const messages = [
      { role: "user",      content: "Turn 1" },
      { role: "assistant", content: "Reply 1" },
      { role: "user",      content: "Turn 2" },
      { role: "assistant", content: "Reply 2" },
      { role: "user",      content: "Turn 3" },
      { role: "assistant", content: "Reply 3" },
      { role: "user",      content: "Turn 4 — final question" },
    ];
    await streamClaudeChat({ apiKey: "test-key", model: "claude-sonnet", messages });
    const msgs = capturedBody?.messages as Array<{ role: string; content: unknown }>;

    // Find any message with cache_control in its content blocks
    const cachedMsg = msgs.find((m) => {
      if (!Array.isArray(m.content)) return false;
      return (m.content as Array<{ cache_control?: unknown }>).some((b) => b.cache_control);
    });

    expect(cachedMsg).toBeDefined();
    // Critical: must be a user turn, never an assistant turn
    expect(cachedMsg?.role).toBe("user");
  });

  it("no midpoint cache breakpoint for short conversations (< 6 turns)", async () => {
    const { streamClaudeChat } = await import("./anthropic-api");
    const messages = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
      { role: "user", content: "Follow up" },
    ];
    await streamClaudeChat({ apiKey: "test-key", model: "claude-sonnet", messages });
    const msgs = capturedBody?.messages as Array<{ content: unknown }>;
    const hasBlockCache = msgs.some((m) => {
      if (!Array.isArray(m.content)) return false;
      return (m.content as Array<{ cache_control?: unknown }>).some((b) => b.cache_control);
    });
    expect(hasBlockCache).toBe(false);
  });

  it("midpoint cached turn is not the final user turn (the live question)", async () => {
    const { streamClaudeChat } = await import("./anthropic-api");
    const finalQuestion = "This is the final live question";
    const messages = [
      { role: "user",      content: "Turn 1" },
      { role: "assistant", content: "Reply 1" },
      { role: "user",      content: "Turn 2" },
      { role: "assistant", content: "Reply 2" },
      { role: "user",      content: "Turn 3" },
      { role: "assistant", content: "Reply 3" },
      { role: "user",      content: finalQuestion },
    ];
    await streamClaudeChat({ apiKey: "test-key", model: "claude-sonnet", messages });
    const msgs = capturedBody?.messages as Array<{ role: string; content: unknown }>;

    const cachedMsg = msgs.find((m) => {
      if (!Array.isArray(m.content)) return false;
      return (m.content as Array<{ cache_control?: unknown; text?: string }>).some((b) => b.cache_control);
    });

    // The live question must NOT be the cached one
    const cachedText = (cachedMsg?.content as Array<{ text?: string }>)?.[0]?.text ?? "";
    expect(cachedText).not.toContain(finalQuestion);
  });
});
