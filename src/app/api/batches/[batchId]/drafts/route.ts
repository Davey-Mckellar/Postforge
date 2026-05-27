import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/index";
import { drafts } from "@/lib/db/schema";

export const runtime = "nodejs";

type Params = { params: Promise<{ batchId: string }> };

/**
 * PATCH /api/batches/[batchId]/drafts
 * Body: { draftId: string, caption?: string, status?: string, visualBrief?: string }
 *
 * Updates a single draft (edit caption, approve, reject).
 * Status values: DRAFT | APPROVED | REJECTED | SCHEDULED
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const orgId = req.headers.get("x-organization-id");
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { batchId } = await params;

  let body: {
    draftId?: string;
    caption?: string;
    status?: string;
    visualBrief?: string;
    pillar?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const draftId = body.draftId?.trim();
  if (!draftId) return NextResponse.json({ error: "draftId is required" }, { status: 400 });

  const VALID_STATUSES = ["DRAFT", "APPROVED", "REJECTED", "SCHEDULED"];
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const updates: Partial<typeof drafts.$inferInsert> = { updatedAt: new Date() };
  if (body.caption !== undefined) updates.caption = body.caption;
  if (body.status !== undefined) updates.status = body.status;
  if (body.visualBrief !== undefined) updates.visualBrief = body.visualBrief;
  if (body.pillar !== undefined) updates.pillar = body.pillar;

  const db = getDb();
  const [updated] = await db
    .update(drafts)
    .set(updates)
    .where(
      and(
        eq(drafts.id, draftId),
        eq(drafts.batchId, batchId),
        eq(drafts.organizationId, orgId),
      ),
    )
    .returning();

  if (!updated) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  return NextResponse.json({ draft: updated });
}
