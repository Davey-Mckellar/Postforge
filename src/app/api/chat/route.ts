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
import { parseModelTierBody } from "@/lib/model-tier";
import { trimContext } from "@/lib/context-trim";
import type { ChatMessage, ModelTier } from "@/lib/types";

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

  const commonHeaders = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive" as const,
    "X-bbGPT-Model": routed,
    "X-bbGPT-Routing-Reason": encodeURIComponent(routingReason),
  };

  try {
    // -- Anthropic Claude ---------------------------------------------------
    if (llm.provider === "anthropic" || isClaudeTier(routed)) {
      const anthropicKey =
        llm.provider === "anthropic"
          ? llm.apiKey
          : (process.env.ANTHROPIC_API_KEY?.trim() ?? "");
      const stream = await streamClaudeChat({
        apiKey: anthropicKey,
        model: routed,
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        thinking: thinking === "on",
      });
      return new Response(stream, {
        headers: {
          ...commonHeaders,
          "X-bbGPT-Provider": "anthropic",
          "X-bbGPT-Claude-Model": routed,
        },
      });
    }

    // -- OpenRouter (Claude via OpenAI-compat — fallback) -------------------
    if (llm.provider === "openrouter") {
      const stream = await streamOpenRouterChat({
        apiKey: llm.apiKey,
        model: routed,
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      });
      return new Response(stream, {
        headers: {
          ...commonHeaders,
          "X-bbGPT-Provider": "openrouter",
          "X-bbGPT-Claude-Model": routed,
        },
      });
    }

    // -- Meta Llama (Llama 4 Maverick/Scout — waitlist, free when active) -----
    if (llm.provider === "meta-llama") {
      const stream = await streamMetaLlamaChat({
        apiKey: llm.apiKey,
        model: routed,
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      });
      return new Response(stream, {
        headers: { ...commonHeaders, "X-bbGPT-Provider": "meta-llama" },
      });
    }

    // -- Cerebras (Llama — 1M tokens/day free) --------------------------------
    if (llm.provider === "cerebras") {
      const stream = await streamCerebrasChat({
        apiKey: llm.apiKey,
        model: routed,
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      });
      return new Response(stream, {
        headers: { ...commonHeaders, "X-bbGPT-Provider": "cerebras" },
      });
    }

    // -- OpenRouter free Llama 4 (:free tier — no balance needed) -------------
    if (llm.provider === "openrouter-free") {
      const stream = await streamOpenRouterFreeChat({
        apiKey: llm.apiKey,
        model: routed,
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      });
      return new Response(stream, {
        headers: { ...commonHeaders, "X-bbGPT-Provider": "openrouter-free" },
      });
    }

    // -- Groq (free tier — Llama 3.3 70B fallback for Claude tiers) ----------
    if (llm.provider === "groq") {
      const stream = await streamGroqChat({
        apiKey: llm.apiKey,
        model: routed,
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      });
      return new Response(stream, {
        headers: {
          ...commonHeaders,
          "X-bbGPT-Provider": "groq",
        },
      });
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
        return new Response(result, {
          headers: {
            ...commonHeaders,
            "X-bbGPT-Provider": "zai",
          },
        });
      }
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
    const stream = await streamOpenAIChat({
      apiKey: (llm as { apiKey: string }).apiKey,
      model: omodel,
      messages: openaiMsgs,
    });

    return new Response(stream, {
      headers: {
        ...commonHeaders,
        "X-bbGPT-Provider": "openai",
        "X-bbGPT-OpenAI-Model": omodel,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chat failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
