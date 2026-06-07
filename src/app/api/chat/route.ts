import { NextResponse, type NextRequest } from "next/server";
import { buildHolographicMessages } from "@/lib/holographic-context";
import { resolveLlm } from "@/lib/llm-resolve";
import { mapTierToOpenAIModel, streamOpenAIChat } from "@/lib/openai-api";
import { streamClaudeChat, isClaudeTier } from "@/lib/anthropic-api";
import { streamOpenRouterChat, streamOpenRouterFreeChat } from "@/lib/openrouter-api";
import { streamGroqChat } from "@/lib/groq-api";
import { streamCerebrasChat } from "@/lib/cerebras-api";
import { streamMetaLlamaChat } from "@/lib/meta-llama-api";
import { mergeOpenAiThinkingDirective } from "@/lib/openai-thinking";
import { routeWithKolmogorovDetailed } from "@/lib/kolmogorov-router";
import { extractStyleDNA } from "@/lib/user-dna";
import { adiabaticSystemPrompt } from "@/lib/adiabatic-prompt";
import { guardChatSend } from "@/lib/chat-route-guard";
import { validatePlanLimit, PlanLimitError } from "@/lib/validate-plan-limit";
import {
  InsufficientCreditsError,
  reserveCredits,
  reconcileCredits,
  refundReservation,
} from "@/services/credit-accounting";
import { parseModelTierBody } from "@/lib/model-tier";
import { trimContext } from "@/lib/context-trim";
import type { ChatMessage, ModelTier } from "@/lib/types";

/**
 * Wraps a streaming AI response with pre-flight credit reservation and
 * post-flight reconciliation. On stream completion the estimated credit
 * reservation is replaced with the actual token-based charge. On any
 * stream error or client disconnect the reservation is fully refunded.
 *
 * Only called when `orgId` is present — falls back to unwrapped stream
 * for legacy/wallet-only users.
 */
async function withStreamCredits(
  orgId: string,
  model: string,
  estimatedInputTokens: number,
  getStream: () => Promise<ReadableStream<Uint8Array>>,
  responseHeaders: Record<string, string>,
): Promise<Response> {
  // 600 output tokens is a conservative estimate; reconcileCredits corrects it.
  const estimatedCredits = Math.max(1, Math.ceil((estimatedInputTokens + 600 * 3) / 1000));

  let aiRunId: string;
  try {
    aiRunId = await reserveCredits(orgId, estimatedCredits, "CHAT", model);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: "Insufficient credits", required: err.required, available: err.available, upgradeRequired: true },
        { status: 402 },
      );
    }
    throw err;
  }

  let raw: ReadableStream<Uint8Array>;
  try {
    raw = await getStream();
  } catch (err) {
    await refundReservation(aiRunId, err instanceof Error ? err.message : "Stream init failed");
    throw err;
  }

  // Intercept bytes to count output; reconcile on clean close, refund on error/disconnect.
  let outputBytes = 0;
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      outputBytes += chunk.length;
      controller.enqueue(chunk);
    },
    async flush() {
      // Each byte ≈ 1 char; divide by 4 for approximate token count.
      const actualOutputTokens = Math.ceil(outputBytes / 4);
      await reconcileCredits(aiRunId, estimatedInputTokens, actualOutputTokens);
    },
  });

  // If the client disconnects or the upstream errors, refund the reservation.
  raw.pipeTo(writable).catch(async (err: unknown) => {
    await refundReservation(aiRunId, err instanceof Error ? err.message : "Stream error");
  });

  return new Response(readable, { headers: responseHeaders });
}

export const runtime = "nodejs";

type Body = {
  messages: Pick<ChatMessage, "role" | "content">[];
  model: ModelTier;
  thinking?: "on" | "off";
  memoryPrompt?: string;
  skillPrompt?: string;
  quantum?: {
    kolmogorov?: boolean;
    holographic?: boolean;
    dna?: boolean;
    adiabatic?: number;
    qec?: boolean;
  };
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, thinking, quantum, memoryPrompt, skillPrompt } = body;
  const model = parseModelTierBody(body);
  if (!Array.isArray(messages) || !model) {
    return NextResponse.json({ error: "messages[] and a valid model tier are required" }, { status: 400 });
  }

  const llm = resolveLlm(model);
  if (llm.provider === "none") {
    return NextResponse.json({ error: llm.message }, { status: 503 });
  }

  // Org-level plan + credit gate
  const orgId = req.headers.get("x-organization-id");
  if (orgId) {
    try {
      await validatePlanLimit(orgId, "AI_GENERATION");
    } catch (err) {
      if (err instanceof PlanLimitError) {
        return NextResponse.json({ error: err.message, upgradeRequired: true }, { status: 403 });
      }
      if (err instanceof InsufficientCreditsError) {
        return NextResponse.json({ error: "Insufficient credits", required: err.required, available: err.available, upgradeRequired: true }, { status: 402 });
      }
    }
  }

  const gated = await guardChatSend(req, {
    model,
    thinking: thinking === "on",
    mode: "chat",
    quantum: quantum
      ? {
          kolmogorov: Boolean(quantum.kolmogorov),
          holographic: Boolean(quantum.holographic),
          dna: Boolean(quantum.dna),
        }
      : undefined,
  });
  if (gated) {
    return gated;
  }

  const { model: routed, reason: routingReason } = routeWithKolmogorovDetailed(
    model,
    messages,
    quantum?.kolmogorov,
  );
  let msgs = buildHolographicMessages(messages, { enabled: quantum?.holographic });

  const memorySkill = [memoryPrompt, skillPrompt].filter(Boolean).join("\n\n");
  if (memorySkill) {
    msgs = [{ role: "system", content: memorySkill }, ...msgs];
  }

  if (quantum?.dna) {
    const dna = extractStyleDNA(messages as ChatMessage[]);
    if (dna) {
      msgs = [{ role: "system", content: dna }, ...msgs];
    }
  }

  if (quantum?.adiabatic != null) {
    const sys = msgs.find((m) => m.role === "system")?.content ?? "";
    const merged = adiabaticSystemPrompt(sys, quantum.adiabatic);
    msgs = msgs.some((m) => m.role === "system")
      ? msgs.map((m) => (m.role === "system" ? { ...m, content: merged } : m))
      : [{ role: "system", content: merged }, ...msgs];
  }

  msgs = trimContext(msgs);

  // Approximate input token count for credit reservation (chars / 4), measured
  // after context trimming so the estimate reflects what actually gets sent.
  const estimatedInputTokens = Math.ceil(
    msgs.reduce((sum, m) => sum + (typeof m.content === "string" ? m.content.length : 0), 0) / 4,
  );

  const commonHeaders = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive" as const,
    "X-bbGPT-Model": routed,
    "X-bbGPT-Routing-Reason": encodeURIComponent(routingReason),
  };

  // Shorthand: build a streaming Response, crediting if orgId is present.
  const respond = (
    getStream: () => Promise<ReadableStream<Uint8Array>>,
    extraHeaders: Record<string, string>,
  ): Promise<Response> => {
    const headers = { ...commonHeaders, ...extraHeaders };
    if (orgId) {
      return withStreamCredits(orgId, routed, estimatedInputTokens, getStream, headers);
    }
    return getStream().then((s) => new Response(s, { headers }));
  };

  try {
    // -- Anthropic Claude ---------------------------------------------------
    if (llm.provider === "anthropic" || isClaudeTier(routed)) {
      const anthropicKey =
        llm.provider === "anthropic"
          ? llm.apiKey
          : (process.env.ANTHROPIC_API_KEY?.trim() ?? "");
      return await respond(
        () => streamClaudeChat({
          apiKey: anthropicKey,
          model: routed,
          messages: msgs.map((m) => ({ role: m.role, content: m.content })),
          thinking: thinking === "on",
        }),
        { "X-bbGPT-Provider": "anthropic", "X-bbGPT-Claude-Model": routed },
      );
    }

    // -- OpenRouter (Claude via OpenAI-compat — fallback) -------------------
    if (llm.provider === "openrouter") {
      return await respond(
        () => streamOpenRouterChat({
          apiKey: llm.apiKey,
          model: routed,
          messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        }),
        { "X-bbGPT-Provider": "openrouter", "X-bbGPT-Claude-Model": routed },
      );
    }

    // -- Meta Llama (Llama 4 Maverick/Scout) --------------------------------
    if (llm.provider === "meta-llama") {
      return await respond(
        () => streamMetaLlamaChat({
          apiKey: llm.apiKey,
          model: routed,
          messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        }),
        { "X-bbGPT-Provider": "meta-llama" },
      );
    }

    // -- Cerebras (Llama — 1M tokens/day free) ------------------------------
    if (llm.provider === "cerebras") {
      return await respond(
        () => streamCerebrasChat({
          apiKey: llm.apiKey,
          model: routed,
          messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        }),
        { "X-bbGPT-Provider": "cerebras" },
      );
    }

    // -- OpenRouter free Llama 4 (:free tier) --------------------------------
    if (llm.provider === "openrouter-free") {
      return await respond(
        () => streamOpenRouterFreeChat({
          apiKey: llm.apiKey,
          model: routed,
          messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        }),
        { "X-bbGPT-Provider": "openrouter-free" },
      );
    }

    // -- Groq (Llama 3.3 70B fallback) --------------------------------------
    if (llm.provider === "groq") {
      return await respond(
        () => streamGroqChat({
          apiKey: llm.apiKey,
          model: routed,
          messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        }),
        { "X-bbGPT-Provider": "groq" },
      );
    }

    // -- Z.AI / GLM ---------------------------------------------------------
    if (llm.provider === "zai") {
      const thinkingMode =
        thinking === "on" ? { type: "enabled" as const } : { type: "disabled" as const };
      const result = await llm.zai.chat.completions.create({
        model: routed,
        messages: msgs,
        stream: true,
        thinking: thinkingMode,
      });

      if (result instanceof ReadableStream) {
        // Z.AI returns a ReadableStream directly — wire credits the same way.
        const zaiStream = result as ReadableStream<Uint8Array>;
        if (orgId) {
          return await withStreamCredits(
            orgId, routed, estimatedInputTokens,
            () => Promise.resolve(zaiStream),
            { ...commonHeaders, "X-bbGPT-Provider": "zai" },
          );
        }
        return new Response(zaiStream, { headers: { ...commonHeaders, "X-bbGPT-Provider": "zai" } });
      }
      // Non-stream fallback (shouldn't happen in practice)
      return NextResponse.json(result);
    }

    // -- OpenAI fallback ----------------------------------------------------
    const omodel = mapTierToOpenAIModel(routed);
    let openaiMsgs = msgs.map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    }));
    if (thinking === "on") {
      openaiMsgs = mergeOpenAiThinkingDirective(openaiMsgs);
    }
    return await respond(
      () => streamOpenAIChat({
        apiKey: (llm as { apiKey: string }).apiKey,
        model: omodel,
        messages: openaiMsgs,
      }),
      { "X-bbGPT-Provider": "openai", "X-bbGPT-OpenAI-Model": omodel },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chat failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
