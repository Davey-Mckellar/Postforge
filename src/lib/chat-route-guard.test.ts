import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { guardChatSend, guardDebate } from "./chat-route-guard";

vi.mock("@/lib/session-server", () => ({
  assertAuthorized: vi.fn(),
  getOptionalSessionEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/server-config", () => ({
  isGateEnabled: vi.fn(),
  isAdminEmail: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/server-wallet", () => ({
  readServerWallet: vi.fn(),
  tryDebitServerWallet: vi.fn(),
}));

import { assertAuthorized } from "@/lib/session-server";
import { isAdminEmail, isGateEnabled } from "@/lib/server-config";
import { readServerWallet, tryDebitServerWallet } from "@/lib/server-wallet";
import { PLANS } from "@/lib/plans";

function req(): NextRequest {
  return new NextRequest(new URL("http://localhost/"));
}

describe("guardChatSend", () => {
  beforeEach(() => {
    vi.mocked(assertAuthorized).mockResolvedValue(null);
    vi.mocked(isGateEnabled).mockReturnValue(false);
    vi.mocked(isAdminEmail).mockReturnValue(false);
    vi.mocked(readServerWallet).mockReset();
    vi.mocked(tryDebitServerWallet).mockReset();
  });

  it("returns null when gate is off (no server debit)", async () => {
    const out = await guardChatSend(req(), {
      model: "glm-4-flash",
      thinking: false,
      mode: "chat",
    });
    expect(out).toBeNull();
    expect(readServerWallet).not.toHaveBeenCalled();
  });

  it("returns 401 when assertAuthorized fails", async () => {
    vi.mocked(isGateEnabled).mockReturnValue(true);
    vi.mocked(assertAuthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const out = await guardChatSend(req(), {
      model: "glm-4-flash",
      thinking: false,
      mode: "chat",
    });
    expect(out?.status).toBe(401);
    expect(readServerWallet).not.toHaveBeenCalled();
  });

  it("returns null for admin email (bypasses credits entirely)", async () => {
    vi.mocked(isGateEnabled).mockReturnValue(true);
    vi.mocked(assertAuthorized).mockResolvedValue(null);
    vi.mocked(isAdminEmail).mockReturnValue(true);
    const out = await guardChatSend(req(), {
      model: "glm-4-flash",
      thinking: false,
      mode: "chat",
    });
    expect(out).toBeNull();
    expect(readServerWallet).not.toHaveBeenCalled();
    expect(tryDebitServerWallet).not.toHaveBeenCalled();
  });

  it("returns 403 when quantum DNA not on plan", async () => {
    vi.mocked(isGateEnabled).mockReturnValue(true);
    vi.mocked(assertAuthorized).mockResolvedValue(null);
    vi.mocked(readServerWallet).mockResolvedValue({
      version: 1,
      planId: "free",
      balance: 10_000,
      accrualMonth: "2026-01",
      welcomeApplied: true,
    });
    const out = await guardChatSend(req(), {
      model: "glm-4-flash",
      thinking: false,
      mode: "chat",
      quantum: { dna: true },
    });
    expect(out?.status).toBe(403);
    expect(tryDebitServerWallet).not.toHaveBeenCalled();
  });

  it("returns 403 when schrodinger secondary model not on plan", async () => {
    vi.mocked(isGateEnabled).mockReturnValue(true);
    vi.mocked(assertAuthorized).mockResolvedValue(null);
    vi.mocked(readServerWallet).mockResolvedValue({
      version: 1,
      planId: "starter",
      balance: 10_000,
      accrualMonth: "2026-01",
      welcomeApplied: true,
    });
    const out = await guardChatSend(req(), {
      model: "glm-4-flash",
      thinking: false,
      mode: "schrodinger",
      secondaryModel: "glm-4-long",
    });
    expect(out?.status).toBe(403);
    expect(tryDebitServerWallet).not.toHaveBeenCalled();
  });

  it("returns 403 when plan does not permit send mode", async () => {
    vi.mocked(isGateEnabled).mockReturnValue(true);
    vi.mocked(assertAuthorized).mockResolvedValue(null);
    vi.mocked(readServerWallet).mockResolvedValue({
      version: 1,
      planId: "free",
      balance: 10_000,
      accrualMonth: "2026-01",
      welcomeApplied: true,
    });
    const out = await guardChatSend(req(), {
      model: "glm-4-flash",
      thinking: false,
      mode: "agent",
    });
    expect(out?.status).toBe(403);
    expect(tryDebitServerWallet).not.toHaveBeenCalled();
  });

  it("returns 402 when debit fails", async () => {
    vi.mocked(isGateEnabled).mockReturnValue(true);
    vi.mocked(assertAuthorized).mockResolvedValue(null);
    vi.mocked(readServerWallet).mockResolvedValue({
      version: 1,
      planId: "pro",
      balance: PLANS.pro.monthlyCredits,
      accrualMonth: "2026-01",
      welcomeApplied: true,
    });
    vi.mocked(tryDebitServerWallet).mockResolvedValue({
      ok: false,
      wallet: {
        version: 1,
        planId: "pro",
        balance: 0,
        accrualMonth: "2026-01",
        welcomeApplied: true,
      },
    });
    const out = await guardChatSend(req(), {
      model: "glm-4-flash",
      thinking: false,
      mode: "chat",
    });
    expect(out?.status).toBe(402);
  });

  it("returns null when debit succeeds", async () => {
    vi.mocked(isGateEnabled).mockReturnValue(true);
    vi.mocked(assertAuthorized).mockResolvedValue(null);
    vi.mocked(readServerWallet).mockResolvedValue({
      version: 1,
      planId: "pro",
      balance: PLANS.pro.monthlyCredits,
      accrualMonth: "2026-01",
      welcomeApplied: true,
    });
    vi.mocked(tryDebitServerWallet).mockResolvedValue({
      ok: true,
      wallet: {
        version: 1,
        planId: "pro",
        balance: PLANS.pro.monthlyCredits - 1,
        accrualMonth: "2026-01",
        welcomeApplied: true,
      },
    });
    const out = await guardChatSend(req(), {
      model: "glm-4-flash",
      thinking: false,
      mode: "chat",
    });
    expect(out).toBeNull();
    expect(tryDebitServerWallet).toHaveBeenCalled();
  });
});

describe("guardDebate", () => {
  beforeEach(() => {
    vi.mocked(assertAuthorized).mockResolvedValue(null);
    vi.mocked(isGateEnabled).mockReturnValue(false);
    vi.mocked(isAdminEmail).mockReturnValue(false);
    vi.mocked(readServerWallet).mockReset();
    vi.mocked(tryDebitServerWallet).mockReset();
  });

  it("returns null when gate is off", async () => {
    expect(await guardDebate(req())).toBeNull();
  });
});
