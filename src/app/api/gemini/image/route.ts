import { NextResponse, type NextRequest } from "next/server";
import { guardChatSend } from "@/lib/chat-route-guard";
import { requestGeminiNativeImage } from "@/lib/gemini-native-image";
import { createGeminiClient } from "@/lib/gemini-server";
import { parseModelTierBody } from "@/lib/model-tier";
import type { ModelTier } from "@/lib/types";

async function tryDalleFallback(prompt: string): Promise<{ imageUrl: string; model: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "dall-e-3", prompt, n: 1, size: "1024x1024", response_format: "b64_json" }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return null;
    return { imageUrl: b64, model: "dall-e-3" };
  } catch {
    return null;
  }
}

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  prompt: string;
  model?: ModelTier;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const tier = parseModelTierBody({ model: body.model ?? "glm-4-flash" });
  if (!tier) {
    return NextResponse.json({ error: "Invalid model tier" }, { status: 400 });
  }

  const ai = createGeminiClient();
  if (!ai) {
    return NextResponse.json(
      { error: "Set GEMINI_API_KEY to generate images with Gemini." },
      { status: 503 },
    );
  }

  const gated = await guardChatSend(req, {
    model: tier,
    thinking: false,
    mode: "chat",
  });
  if (gated) return gated;

  try {
    const result = await requestGeminiNativeImage(ai, prompt);
    if ("error" in result) {
      // If Gemini quota is exhausted, try DALL-E 3 as fallback
      if (/quota|RESOURCE_EXHAUSTED|429|rate.?limit/i.test(result.error)) {
        const dalle = await tryDalleFallback(prompt);
        if (dalle) {
          return NextResponse.json({
            mimeType: "image/png",
            imageBase64: dalle.imageUrl,
            model: dalle.model,
          });
        }
      }
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json({
      mimeType: result.mimeType,
      imageBase64: result.imageBase64,
      model: result.model,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Image generation failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
