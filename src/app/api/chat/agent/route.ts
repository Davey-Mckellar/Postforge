import { NextResponse, type NextRequest } from "next/server";
import { adiabaticSystemPrompt } from "@/lib/adiabatic-prompt";
import { runReactAgentLoop } from "@/lib/agent-loop";
import { guardChatSend } from "@/lib/chat-route-guard";
import { buildHolographicMessages } from "@/lib/holographic-context";
import { parseModelTierBody } from "@/lib/model-tier";
import type { ChatMessage, ModelTier } from "@/lib/types";
import { extractStyleDNA } from "@/lib/user-dna";
import { resolveLlm } from "@/lib/llm-resolve";
import { trimContext } from "@/lib/context-trim";

export const runtime = "nodejs";

type Body = {
  messages: Pick<ChatMessage, "role" | "content">[];
  model: ModelTier;
  thinking?: "on" | "off";
  quantum?: {
    kolmogorov?: boolean;
    holographic?: boolean;
    dna?: boolean;
    adiabatic?: number;
  };
  memoryPrompt?: string;
  skillPrompt?: string;
};

function sseData(obj: unknown) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

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
    mode: "agent",
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

  const folded = trimContext(buildHolographicMessages(messages, { enabled: quantum?.holographic }));
  const extraParts = [memoryPrompt, skillPrompt].filter(Boolean);
  if (quantum?.dna) {
    const dna = extractStyleDNA(messages as ChatMessage[]);
    if (dna) extraParts.push(dna);
  }
  let extra = extraParts.join("\n\n");
  if (quantum?.adiabatic != null) {
    extra = adiabaticSystemPrompt(extra, quantum.adiabatic);
  }

  const agentMessages = folded.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  try {
    const agentOpts = {
      messages: agentMessages,
      preferredModel: model,
      kolmogorov: Boolean(quantum?.kolmogorov),
      thinking: thinking === "on",
      extraSystem: extra || undefined,
    };
    const result = await runReactAgentLoop(
      llm.provider === "zai"
        ? { ...agentOpts, zai: llm.zai }
        : llm.provider === "anthropic"
        ? { ...agentOpts, anthropicApiKey: llm.apiKey }
        : llm.provider === "openrouter"
        ? { ...agentOpts, openrouterApiKey: llm.apiKey }
        : llm.provider === "openrouter-free"
        ? { ...agentOpts, openrouterFreeApiKey: llm.apiKey }
        : llm.provider === "meta-llama"
        ? { ...agentOpts, metaLlamaApiKey: llm.apiKey }
        : llm.provider === "cerebras"
        ? { ...agentOpts, cerebrasApiKey: llm.apiKey }
        : llm.provider === "groq"
        ? { ...agentOpts, groqApiKey: llm.apiKey }
        : { ...agentOpts, openaiApiKey: (llm as { apiKey: string }).apiKey },
    );

    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          enc.encode(
            sseData({
              choices: [{ delta: { content: "" } }],
              bbgpt_agent: {
                toolCalls: result.toolCalls,
                errorCorrectionLog: result.errorCorrectionLog,
                routingReason: result.routingReason,
              },
            }),
          ),
        );
        const text = result.finalText;
        const step = 48;
        for (let i = 0; i < text.length; i += step) {
          const part = text.slice(i, i + step);
          controller.enqueue(
            enc.encode(
              sseData({
                choices: [{ delta: { content: part } }],
              }),
            ),
          );
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-bbGPT-Model": result.plannerModel,
        "X-bbGPT-Routing-Reason": encodeURIComponent(result.routingReason),
        "X-bbGPT-Provider": llm.provider,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Agent failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
