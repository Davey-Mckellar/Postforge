import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/index";
import { contentBatches } from "@/lib/db/schema";
import { generateContentBatch } from "@/services/content-batch";
import { PlanLimitError } from "@/lib/validate-plan-limit";
import { InsufficientCreditsError } from "@/services/credit-accounting";

export const runtime = "nodejs";
// Batch generation can take 15–30s for 30 captions — extend timeout
export const maxDuration = 60;

/** GET /api/batches — list all batches for the org (most recent first) */
export async function GET(req: NextRequest) {
  const orgId = req.headers.get("x-organization-id");
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const rows = await db
    .select()
    .from(contentBatches)
    .where(eq(contentBatches.organizationId, orgId))
    .orderBy(desc(contentBatches.createdAt));

  return NextResponse.json({ batches: rows });
}

/**
 * POST /api/batches
 * Body: { brandId: string, itemCount?: number }
 *
 * Triggers AI generation synchronously. The route has maxDuration: 60s.
 * Returns the full batch + drafts on success.
 */
export async function POST(req: NextRequest) {
  const orgId = req.headers.get("x-organization-id");
  const userId = req.headers.get("x-user-id");
  if (!orgId || !userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { brandId?: string; itemCount?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const brandId = body.brandId?.trim();
  if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

  const itemCount = Math.min(Math.max(Number(body.itemCount ?? 30), 1), 60);

  try {
    const result = await generateContentBatch(orgId, brandId, userId, itemCount);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, upgradeRequired: true }, { status: 403 });
    }
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: "Insufficient credits", required: err.required, available: err.available, upgradeRequired: true },
        { status: 402 },
      );
    }
    const msg = err instanceof Error ? err.message : "Batch generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
