import { assertAuthorized, getOptionalSessionEmail } from "@/lib/session-server";
import { isAdminEmail, isGateEnabled } from "@/lib/server-config";
import { readServerWallet, tryDebitServerWallet } from "@/lib/server-wallet";
import { PLANS } from "@/lib/plans";
import {
  COMMUNITY_DEBATE_COST,
  estimateSendCredits,
  planPermitsSend,
  type ChatSendPlanCheck,
} from "@/lib/usage-cost";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Auth + optional server wallet debit for chat-style routes.
 * When gate is disabled, returns `null` (caller continues, no server debit).
 */
export async function guardChatSend(
  request: NextRequest,
  input: ChatSendPlanCheck,
): Promise<NextResponse | null> {
  const denied = await assertAuthorized(request);
  if (denied) {
    return denied;
  }
  if (!isGateEnabled()) {
    return null;
  }
  // Creator / admin bypass — no credit deduction, all features unlocked
  const email = await getOptionalSessionEmail(request);
  if (isAdminEmail(email)) return null;

  const wallet = await readServerWallet(request);
  const plan = PLANS[wallet.planId];
  if (!planPermitsSend(plan, input)) {
    return NextResponse.json(
      { error: "Your plan does not include this model or mode. Change plan or settings." },
      { status: 403 },
    );
  }

  const cost = estimateSendCredits({
    model: input.model,
    thinking: input.thinking,
    mode: input.mode,
  });
  const { ok } = await tryDebitServerWallet(cost, request);
  if (!ok) {
    return NextResponse.json(
      { error: `Insufficient credits (this send needs ${cost}).` },
      { status: 402 },
    );
  }
  return null;
}

/**
 * Same plan/credit checks as `guardChatSend` but does **not** debit — use before a follow-up route
 * that will debit (e.g. multipart file upload before `/api/chat/gemini`).
 */
export async function guardChatSendBalanceOnly(
  request: NextRequest,
  input: ChatSendPlanCheck,
): Promise<NextResponse | null> {
  const denied = await assertAuthorized(request);
  if (denied) {
    return denied;
  }
  if (!isGateEnabled()) {
    return null;
  }
  const email = await getOptionalSessionEmail(request);
  if (isAdminEmail(email)) return null;

  const wallet = await readServerWallet(request);
  const plan = PLANS[wallet.planId];
  if (!planPermitsSend(plan, input)) {
    return NextResponse.json(
      { error: "Your plan does not include this model or mode. Change plan or settings." },
      { status: 403 },
    );
  }

  const cost = estimateSendCredits({
    model: input.model,
    thinking: input.thinking,
    mode: input.mode,
  });
  if (wallet.balance < cost) {
    return NextResponse.json(
      { error: `Insufficient credits (this chat send needs ${cost}).` },
      { status: 402 },
    );
  }
  return null;
}

export async function guardDebate(request: NextRequest): Promise<NextResponse | null> {
  const denied = await assertAuthorized(request);
  if (denied) {
    return denied;
  }
  if (!isGateEnabled()) {
    return null;
  }
  const email = await getOptionalSessionEmail(request);
  if (isAdminEmail(email)) return null;

  const wallet = await readServerWallet(request);
  const plan = PLANS[wallet.planId];
  if (!plan.features.communityDebate) {
    return NextResponse.json({ error: "Debate not included on your plan." }, { status: 403 });
  }

  const { ok } = await tryDebitServerWallet(COMMUNITY_DEBATE_COST, request);
  if (!ok) {
    return NextResponse.json(
      { error: `Insufficient credits (debate costs ${COMMUNITY_DEBATE_COST}).` },
      { status: 402 },
    );
  }
  return null;
}

/** Gate-only (no debit) for community CRUD. */
export async function guardApi(request: NextRequest): Promise<NextResponse | null> {
  return assertAuthorized(request);
}
