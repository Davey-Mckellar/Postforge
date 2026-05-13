import { createUserContent, Modality, type GoogleGenAI } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";
import {
  describeGeminiImageFailure,
  extractGeminiImageBestEffort,
  tryGeminiResponseText,
} from "@/lib/gemini-image-response";
import { getGeminiImageModel } from "@/lib/gemini-server";

export type GeminiNativeImageOk = {
  mimeType: string;
  imageBase64: string;
  model: string;
};

export type GeminiNativeImageErr = { error: string };

function isModelMissingError(msg: string): boolean {
  return /\b404\b|not\s+found|NOT_FOUND|invalid\s+model|unknown\s+model|no\s+matching\s+model/i.test(msg);
}

function isFatalApiError(msg: string): boolean {
  return /\b401\b|\b403\b|PERMISSION_DENIED|API\s+key|quota|429|billing|payment/i.test(msg);
}

function parseImageError(raw: string): string {
  if (/429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(raw)) {
    return "Gemini image quota exhausted. Please try again later or switch to a different model.";
  }
  if (/401|403|API.?key|PERMISSION_DENIED|billing|payment/i.test(raw)) {
    return "Gemini API key is invalid or lacks billing. Check GEMINI_API_KEY in your environment.";
  }
  if (/SAFETY|HARM|blocked/i.test(raw)) {
    return "Gemini blocked this image request due to safety filters. Try a different prompt.";
  }
  const clean = raw.replace(/\{[\s\S]*\}/g, "").trim().slice(0, 120);
  return clean || "Image generation failed. Please try again.";
}

/**
 * Calls Gemini native image models with the same shapes as Google's docs (string `contents`,
 * optional modalities) and falls back across a few model IDs when the configured ID is unavailable.
 */
export async function requestGeminiNativeImage(
  ai: GoogleGenAI,
  prompt: string,
): Promise<GeminiNativeImageOk | GeminiNativeImageErr> {
  const configured = getGeminiImageModel();
  const fallbackModels = ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"] as const;
  const models = [configured, ...fallbackModels.filter((m) => m !== configured)];

  const buildAttempts = (imageModel: string): Array<() => Promise<GenerateContentResponse>> => [
    () => ai.models.generateContent({ model: imageModel, contents: prompt }),
    () =>
      ai.models.generateContent({
        model: imageModel,
        contents: prompt,
        config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
      }),
    () =>
      ai.models.generateContent({
        model: imageModel,
        contents: prompt,
        config: { responseModalities: [Modality.IMAGE] },
      }),
    () =>
      ai.models.generateContent({
        model: imageModel,
        contents: createUserContent(prompt),
        config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
      }),
  ];

  let lastError = "";
  let lastTextHint = "";

  outer: for (const imageModel of models) {
    for (const run of buildAttempts(imageModel)) {
      try {
        const response = await run();
        const extracted = extractGeminiImageBestEffort(response);
        if (extracted) {
          return {
            mimeType: extracted.mimeType,
            imageBase64: extracted.base64,
            model: imageModel,
          };
        }

        const blocked = describeGeminiImageFailure(response);
        if (blocked) {
          return { error: blocked };
        }

        const t = tryGeminiResponseText(response);
        if (t) lastTextHint = t;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (isFatalApiError(msg)) {
          return { error: parseImageError(msg) };
        }
        if (isModelMissingError(msg)) {
          lastError = msg;
          break;
        }
        lastError = msg;
      }
    }
  }

  const tail = lastTextHint.trim() || lastError.trim();
  return {
    error:
      tail ||
      "No image returned — try another prompt or set GEMINI_IMAGE_MODEL (e.g. gemini-3.1-flash-image-preview).",
  };
}
