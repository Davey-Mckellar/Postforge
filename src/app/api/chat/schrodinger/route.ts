import { NextResponse, type NextRequest } from "next/server";
import { guardChatSend } from "@/lib/chat-route-guard";
import { isModelTier } from "@/lib/model-tier";
import type { ChatMessage, ModelTier } from "@/lib/types";
import { resolveLlm } from "@/lib/llm-resolve";
import { mapTierToOpenAIModel, streamOpenAIChat } from "@/lib/openai-api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: {
    messages: Pick<ChatMessage, "role" | "content">[];
    modelA?: ModelTier;
    modelB?: ModelTier;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const modelA = body.modelA ?? "glm-4-flash";
  const modelB = body.modelB ?? "glm-4-air";
  if (!isModelTier(modelA) || !isModelTier(modelB)) {
    return NextResponse.json({ error: "modelA and modelB must be valid GLM tier ids" }, { status: 400 });
  }

  const llm = resolveLlm();
  if (llm.provider === "none") {
    return NextResponse.json({ error: llm.message }, { status: 503 });
  }

  const gated = await guardChatSend(req, {
    model: modelA,
    thinking: false,
    mode: "schrodinger",
    secondaryModel: modelB,
  });
  if (gated) {
    return gated;
  }

  try {
    if (llm.provider === "openai") {
      const [s1, s2] = await Promise.all([
        streamOpenAIChat({
          apiKey: llm.apiKey,
          model: mapTierToOpenAIModel(modelA),
          messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
        }),
        streamOpenAIChat({
          apiKey: llm.apiKey,
          model: mapTierToOpenAIModel(modelB),
          messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      ]);
      return mergeSchrodingerStreams(s1, s2, modelA, modelB, "openai");
    }

    if (llm.provider !== "zai") {
      return NextResponse.json({ error: "Schrodinger mode requires Z.AI" }, { status: 503 });
    }
    const zai = llm.zai;
    const [r1, r2] = await Promise.all([
      zai.chat.completions.create({
        model: modelA,
        messages: body.messages,
        stream: true,
        thinking: { type: "disabled" },
      }),
      zai.chat.completions.create({
        model: modelB,
        messages: body.messages,
        stream: true,
        thinking: { type: "disabled" },
      }),
    ]);

    const s1 = r1 as ReadableStream<Uint8Array>;
    const s2 = r2 as ReadableStream<Uint8Array>;
    return mergeSchrodingerStreams(s1, s2, modelA, modelB, "zai");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Schrodinger failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

function mergeSchrodingerStreams(
  s1: ReadableStream<Uint8Array>,
  s2: ReadableStream<Uint8Array>,
  modelA: string,
  modelB: string,
  provider: string,
) {
  const merged = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const reader1 = s1.getReader();
      const reader2 = s2.getReader();

      const first = await Promise.race([
        reader1.read().then((chunk) => ({ n: 1 as const, chunk })),
        reader2.read().then((chunk) => ({ n: 2 as const, chunk })),
      ]);

      const winner = first.n === 1 ? modelA : modelB;
      controller.enqueue(
        enc.encode("data: " + JSON.stringify({ schrodinger: true, winner }) + "\n\n"),
      );

      const primary = first.n === 1 ? reader1 : reader2;
      const secondary = first.n === 1 ? reader2 : reader1;

      if (!first.chunk.done && first.chunk.value) {
        controller.enqueue(first.chunk.value);
      }

      while (true) {
        const { done, value } = await primary.read();
        if (done) break;
        if (value) controller.enqueue(value);
      }
      await secondary.cancel();
      controller.close();
    },
  });

  return new Response(merged, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-bbGPT-Schrodinger": "1",
      "X-bbGPT-Provider": provider,
    },
  });
}