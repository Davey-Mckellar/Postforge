const OPENAI_IMAGE_GEN = "https://api.openai.com/v1/images/generations";

export type OpenAiImageOk = {
  mimeType: string;
  imageBase64: string;
  model: string;
};

export type OpenAiImageErr = { error: string };

function pickErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    return parsed.error?.message?.trim() || raw.trim();
  } catch {
    return raw.trim();
  }
}

/**
 * OpenAI fallback for image generation when Gemini image quota is exhausted.
 * Uses gpt-image-1 and returns base64 to match existing client rendering path.
 */
export async function requestOpenAiImageFallback(
  apiKey: string,
  prompt: string,
): Promise<OpenAiImageOk | OpenAiImageErr> {
  const res = await fetch(OPENAI_IMAGE_GEN, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    return { error: pickErrorMessage(raw) || "OpenAI image fallback failed." };
  }

  try {
    const parsed = JSON.parse(raw) as {
      data?: Array<{ b64_json?: string }>;
    };
    const b64 = parsed.data?.[0]?.b64_json?.trim();
    if (!b64) {
      return { error: "OpenAI image fallback returned no image data." };
    }
    return {
      mimeType: "image/png",
      imageBase64: b64,
      model: "gpt-image-1",
    };
  } catch {
    return { error: "OpenAI image fallback returned invalid JSON." };
  }
}
