import { NextResponse, type NextRequest } from "next/server";
import { guardChatSend } from "@/lib/chat-route-guard";
import { bbgptMessagesToGeminiContents, type PayloadMessage } from "@/lib/gemini-contents";
import { createGeminiClient, getGeminiChatModel } from "@/lib/gemini-server";
import type { GoogleGenAI } from "@google/genai";
import { getServerMaxFileBytes } from "@/lib/attachment-config";
import { parseModelTierBody } from "@/lib/model-tier";
import type { ModelTier } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

function sseOpenAiDelta(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
}

/**
 * Converts a raw Gemini API error (often a JSON blob inside e.message)
 * into a short, user-readable sentence.
 */
function parseGeminiError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);

  // 429 / quota exhausted
  if (/429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(raw)) {
    return "Gemini free-tier quota exceeded. Switch to a different model (e.g. GLM or GPT-4o) or try again in a minute.";
  }
  // Auth / key problems
  if (/401|403|API.?key|PERMISSION_DENIED|billing|payment/i.test(raw)) {
    return "Gemini API key is invalid or lacks billing. Check GEMINI_API_KEY in your environment.";
  }
  // Safety block
  if (/SAFETY|HARM|blocked/i.test(raw)) {
    return "Gemini blocked this request due to its safety filters. Try rephrasing your message.";
  }
  // Generic — strip JSON noise, keep first 120 chars
  const clean = raw.replace(/\{[\s\S]*\}/g, "").trim().slice(0, 120);
  return clean || "Gemini request failed. Please try again.";
}

function validateAttachments(messages: PayloadMessage[], maxBytes: number): string | null {
  for (const m of messages) {
    for (const a of m.attachments ?? []) {
      if (a.sizeBytes > maxBytes) {
        return `File "${a.name}" exceeds max size (${maxBytes} bytes).`;
      }
      const hasInline = Boolean(a.dataBase64?.length);
      const hasRef = Boolean(a.geminiFileName?.trim());
      if (!hasInline && !hasRef) {
        return `Attachment "${a.name}" is missing data.`;
      }
      if (hasInline && a.dataBase64) {
        const approx = Math.ceil((a.dataBase64.length * 3) / 4);
        if (approx > maxBytes * 1.05) {
          return `File "${a.name}" payload too large.`;
        }
      }
    }
  }
  return null;
}

async function hydrateGeminiFileRefs(ai: GoogleGenAI, messages: PayloadMessage[]): Promise<string | null> {
  for (const m of messages) {
    for (const a of m.attachments ?? []) {
      if (a.dataBase64) continue;
      if (!a.geminiFileName?.trim()) {
        return `Attachment "${a.name}" needs a Gemini file reference.`;
      }
      try {
        const f = await ai.files.get({ name: a.geminiFileName });
        if (String(f.state) !== "ACTIVE" || !f.uri) {
          return `File "${a.name}" is not ready (${String(f.state)}).`;
        }
        a.geminiFileUri = f.uri;
      } catch {
        return `Could not verify "${a.name}" with Gemini.`;
      }
    }
  }
  return null;
}

type Body = {
  messages: PayloadMessage[];
  model: ModelTier;
  memoryPrompt?: string;
  skillPrompt?: string;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const model = parseModelTierBody(body as { model: ModelTier });
  if (!Array.isArray(body.messages) || !model) {
    return NextResponse.json({ error: "messages[] and model required" }, { status: 400 });
  }

  const ai = createGeminiClient();
  if (!ai) {
    return NextResponse.json(
      { error: "Gemini is not configured. Set GEMINI_API_KEY for file uploads and multimodal chat." },
      { status: 503 },
    );
  }

  const maxFile = getServerMaxFileBytes();
  const attachErr = validateAttachments(body.messages, maxFile);
  if (attachErr) {
    return NextResponse.json({ error: attachErr }, { status: 413 });
  }

  const hydrateErr = await hydrateGeminiFileRefs(ai, body.messages);
  if (hydrateErr) {
    return NextResponse.json({ error: hydrateErr }, { status: 400 });
  }

  const memorySkill = [body.memoryPrompt, body.skillPrompt].filter(Boolean).join("\n\n");

  const gated = await guardChatSend(req, {
    model,
    thinking: false,
    mode: "chat",
  });
  if (gated) return gated;

  const { contents, systemInstruction } = bbgptMessagesToGeminiContents(body.messages, memorySkill);

  const chatModel = getGeminiChatModel();

  try {
    const stream = await ai.models.generateContentStream({
      model: chatModel,
      contents,
      config: {
        systemInstruction: systemInstruction || undefined,
      },
    });

    const enc = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.text;
            if (text) {
              controller.enqueue(enc.encode(sseOpenAiDelta(text)));
            }
          }
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e) {
          const msg = parseGeminiError(e);
          controller.enqueue(enc.encode(sseOpenAiDelta(`\n\n⚠️ ${msg}`)));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-bbGPT-Provider": "gemini",
        "X-bbGPT-Model": chatModel,
      },
    });
  } catch (e) {
    const msg = parseGeminiError(e);
    const status = /quota|429|RESOURCE_EXHAUSTED/i.test(e instanceof Error ? e.message : "") ? 429 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
