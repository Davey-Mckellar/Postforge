import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/index";
import { contentBatches, drafts } from "@/lib/db/schema";

export const runtime = "nodejs";

type Params = { params: Promise<{ batchId: string }> };

/** GET /api/batches/[batchId] — fetch batch metadata + all its drafts */
export async function GET(req: NextRequest, { params }: Params) {
  const orgId = req.headers.get("x-organization-id");
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { batchId } = await params;
  const db = getDb();

  const [batch] = await db
    .select()
    .from(contentBatches)
    .where(and(eq(contentBatches.id, batchId), eq(contentBatches.organizationId, orgId)))
    .limit(1);

  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const batchDrafts = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.batchId, batchId), eq(drafts.organizationId, orgId)))
    .orderBy(drafts.createdAt);

  return NextResponse.json({ batch, drafts: batchDrafts });
}
