import { describe, it, expect } from "vitest";
import { trimContext, CONTEXT_CHAR_BUDGET, CONTEXT_ANCHOR_TURNS, CONTEXT_TAIL_TURNS } from "./context-trim";

const msg = (role: "user" | "assistant" | "system", content: string) => ({ role, content });
const big = (n: number) => "x".repeat(n);

describe("trimContext", () => {
  it("returns messages unchanged when under budget", () => {
    const msgs = [msg("user", "hello"), msg("assistant", "hi")];
    expect(trimContext(msgs)).toEqual(msgs);
  });

  it("always keeps system messages", () => {
    const sys = msg("system", "You are helpful.");
    const conv = Array.from({ length: 20 }, (_, i) => msg(i % 2 === 0 ? "user" : "assistant", big(4000)));
    const result = trimContext([sys, ...conv], 20_000);
    expect(result.some((m) => m.role === "system" && m.content === sys.content)).toBe(true);
  });

  it("keeps the anchor turns (first CONTEXT_ANCHOR_TURNS non-system messages)", () => {
    const conv = Array.from({ length: 30 }, (_, i) =>
      msg(i % 2 === 0 ? "user" : "assistant", big(3000) + `_msg${i}`),
    );
    const result = trimContext(conv, 20_000);
    const nonSystem = result.filter((m) => m.role !== "system" && !m.content.startsWith("[Note:"));
    const anchor = conv.slice(0, CONTEXT_ANCHOR_TURNS);
    anchor.forEach((a) => {
      expect(nonSystem.some((r) => r.content === a.content)).toBe(true);
    });
  });

  it("keeps the tail turns (last CONTEXT_TAIL_TURNS non-system messages)", () => {
    const conv = Array.from({ length: 30 }, (_, i) =>
      msg(i % 2 === 0 ? "user" : "assistant", big(3000) + `_msg${i}`),
    );
    const result = trimContext(conv, 20_000);
    const nonSystem = result.filter((m) => m.role !== "system" && !m.content.startsWith("[Note:"));
    const tail = conv.slice(-CONTEXT_TAIL_TURNS);
    tail.forEach((t) => {
      expect(nonSystem.some((r) => r.content === t.content)).toBe(true);
    });
  });

  it("stub is role:user, not role:system (so it doesn't pollute the cached system block)", () => {
    const conv = Array.from({ length: 20 }, () => msg("user", big(4000)));
    const result = trimContext(conv, 20_000);
    const stub = result.find((m) => m.content.startsWith("[Note:"));
    expect(stub).toBeDefined();
    expect(stub?.role).toBe("user");
  });

  it("does not add a stub when nothing was dropped", () => {
    const msgs = [msg("user", "short"), msg("assistant", "reply")];
    expect(trimContext(msgs).some((m) => m.content.startsWith("[Note:"))).toBe(false);
  });

  it("result fits within budget (with stub overhead tolerance)", () => {
    const conv = Array.from({ length: 40 }, () => msg("user", big(3000)));
    const result = trimContext(conv, CONTEXT_CHAR_BUDGET);
    const total = result.reduce((n, m) => n + m.content.length, 0);
    expect(total).toBeLessThanOrEqual(CONTEXT_CHAR_BUDGET + 300);
  });

  it("does not trim when conv length <= anchor + tail", () => {
    const conv = Array.from({ length: CONTEXT_ANCHOR_TURNS + CONTEXT_TAIL_TURNS }, () =>
      msg("user", big(3000)),
    );
    const result = trimContext(conv, 100);
    expect(result).toEqual(conv);
  });
});
