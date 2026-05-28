/**
 * 30-Day Content Batch Generator
 *
 * Flow:
 *   1. validatePlanLimit — gate before any work
 *   2. reserveCredits — atomic pre-flight reservation
 *   3. createZai().chat.completions.create — single non-streaming call
 *   4. Parse JSON response → 30 draft rows
 *   5. DB transaction: insert drafts, mark batch READY
 *   6. reconcileCredits — charge actual tokens, refund over-reservation
 *   7. refundReservation on any failure
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/index";
import { brands, contentBatches, drafts } from "@/lib/db/schema";
import { createZai } from "@/lib/zai";
import {
  reserveCredits,
  reconcileCredits,
  refundReservation,
  InsufficientCreditsError,
} from "@/services/credit-accounting";
import { validatePlanLimit, PlanLimitError } from "@/lib/validate-plan-limit";
import type { VoiceProfile } from "@/lib/voice-profile";

export type { VoiceProfile } from "@/lib/voice-profile";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeneratedDraft {
  caption: string;
  pillar: string;
  visualBrief: string;
  platform: string;
}

export interface BatchResult {
  batchId: string;
  drafts: GeneratedDraft[];
}

// ---------------------------------------------------------------------------
// AI prompt
// ---------------------------------------------------------------------------

function buildBatchPrompt(brand: { name: string; voiceProfile: VoiceProfile | null }): string {
  const vp = brand.voiceProfile ?? {};
  const pillars =
    vp.pillars?.length
      ? vp.pillars.join(", ")
      : "education, inspiration, behind-the-scenes, promotion, community";
  const hashtags = vp.hashtags?.length ? vp.hashtags.join(" ") : "";
  const avoid = vp.avoid ? `\nAvoid: ${vp.avoid}` : "";

  return `You are an expert Instagram content strategist. Generate exactly 30 Instagram post captions for the following brand.

Brand name: ${brand.name}
Niche: ${vp.niche ?? "general"}
Target audience: ${vp.audience ?? "general audience"}
Tone / voice: ${vp.tone ?? "professional and engaging"}
Content pillars: ${pillars}${avoid}
${hashtags ? `Brand hashtags to include occasionally: ${hashtags}` : ""}

Rules:
- Spread posts evenly across all content pillars (6 posts per pillar if 5 pillars, otherwise distribute evenly)
- Each caption must have: a strong hook (first line), body copy (2-4 sentences), and a clear call-to-action
- Vary post length: mix short punchy posts (under 100 chars) with longer storytelling posts
- Each caption must be unique — no repetitive hooks or CTAs
- Include 3-8 relevant hashtags per post (mix niche + broad)
- visualBrief should be a single concrete sentence describing the ideal image/graphic/reel for that post

Return ONLY a valid JSON array with exactly 30 objects. No markdown, no explanation, just the JSON.

Schema for each object:
{
  "caption": "full caption text including hashtags",
  "pillar": "which content pillar this belongs to",
  "visualBrief": "one sentence describing the ideal visual",
  "platform": "INSTAGRAM"
}`;
}

// ---------------------------------------------------------------------------
// Core generation function
// ---------------------------------------------------------------------------

export async function generateContentBatch(
  organizationId: string,
  brandId: string,
  createdByUserId: string,
  itemCount = 30,
): Promise<BatchResult> {
  const db = getDb();

  // 1. Plan gate
  await validatePlanLimit(organizationId, "BATCH_CREATE");

  // 2. Load brand + voice profile
  const [brand] = await db
    .select({ id: brands.id, name: brands.name, voiceProfile: brands.voiceProfile })
    .from(brands)
    .where(eq(brands.id, brandId))
    .limit(1);

  if (!brand) throw new Error(`Brand ${brandId} not found`);

  const prompt = buildBatchPrompt(brand);

  // 3. Create batch row (GENERATING status)
  const [batch] = await db
    .insert(contentBatches)
    .values({
      organizationId,
      brandId,
      createdByUserId,
      itemCount,
      status: "GENERATING",
    })
    .returning({ id: contentBatches.id });

  // 4. Reserve credits (approx: 2k input + itemCount*250 output tokens)
  const estimatedInput = 2_000;
  const estimatedOutput = itemCount * 250;
  const estimatedCredits = Math.max(5, Math.ceil((estimatedInput + estimatedOutput * 3) / 1000));

  let aiRunId: string;
  try {
    aiRunId = await reserveCredits(organizationId, estimatedCredits, "BATCH_GENERATE", "glm-4-plus");
  } catch (err) {
    // Mark batch failed and re-throw so caller gets a clean 402/403
    await db
      .update(contentBatches)
      .set({ status: "FAILED" })
      .where(eq(contentBatches.id, batch.id));
    throw err;
  }

  // 5. Call Z.AI (non-streaming — we need the full JSON response)
  let rawContent: string;
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const zai = createZai();
    const completion = await zai.chat.completions.create({
      model: "glm-4-plus",
      messages: [
        {
          role: "system",
          content:
            "You are a professional Instagram content strategist. You always respond with valid JSON arrays only — no markdown, no explanation.",
        },
        { role: "user", content: prompt },
      ],
      stream: false,
    });

    // Z.AI SDK returns OpenAI-compatible shape
    const choice = (completion as { choices?: Array<{ message?: { content?: string } }> })
      .choices?.[0];
    rawContent = choice?.message?.content ?? "";

    const usage = (completion as { usage?: { prompt_tokens?: number; completion_tokens?: number } })
      .usage;
    inputTokens = usage?.prompt_tokens ?? estimatedInput;
    outputTokens = usage?.completion_tokens ?? estimatedOutput;
  } catch (err) {
    await refundReservation(aiRunId, err instanceof Error ? err.message : "AI call failed");
    await db
      .update(contentBatches)
      .set({ status: "FAILED" })
      .where(eq(contentBatches.id, batch.id));
    throw new Error(`AI generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 6. Parse JSON — strip markdown fences if model wrapped them
  let generated: GeneratedDraft[];
  try {
    const cleaned = rawContent
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(parsed)) throw new Error("Response is not an array");
    generated = (parsed as Array<Record<string, unknown>>).map((item, i) => ({
      caption: String(item.caption ?? ""),
      pillar: String(item.pillar ?? "general"),
      visualBrief: String(item.visualBrief ?? item.visual_brief ?? ""),
      platform: String(item.platform ?? "INSTAGRAM"),
    }));
  } catch (err) {
    await refundReservation(aiRunId, "JSON parse failed");
    await db
      .update(contentBatches)
      .set({ status: "FAILED" })
      .where(eq(contentBatches.id, batch.id));
    throw new Error("Failed to parse AI response as JSON. Try again.");
  }

  // 7. Insert drafts + mark batch READY — single transaction
  await db.transaction(async (tx) => {
    await tx.insert(drafts).values(
      generated.map((d) => ({
        organizationId,
        brandId,
        batchId: batch.id,
        caption: d.caption,
        pillar: d.pillar,
        visualBrief: d.visualBrief,
        platform: d.platform,
        status: "DRAFT",
      })),
    );
    await tx
      .update(contentBatches)
      .set({ status: "READY" })
      .where(eq(contentBatches.id, batch.id));
  });

  // 8. Reconcile credits with actual token counts
  await reconcileCredits(aiRunId, inputTokens, outputTokens);

  return { batchId: batch.id, drafts: generated };
}
