import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/index";
import { brands } from "@/lib/db/schema";

export const runtime = "nodejs";

type Params = { params: Promise<{ brandId: string }> };

/** GET /api/brands/[brandId] */
export async function GET(req: NextRequest, { params }: Params) {
  const orgId = req.headers.get("x-organization-id");
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { brandId } = await params;
  const db = getDb();
  const [brand] = await db
    .select()
    .from(brands)
    .where(and(eq(brands.id, brandId), eq(brands.organizationId, orgId)))
    .limit(1);

  if (!brand) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ brand });
}

/** PATCH /api/brands/[brandId] — update name and/or voice profile */
export async function PATCH(req: NextRequest, { params }: Params) {
  const orgId = req.headers.get("x-organization-id");
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { brandId } = await params;

  let body: { name?: string; voiceProfile?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Partial<typeof brands.$inferInsert> = { updatedAt: new Date() };
  if (body.name?.trim()) updates.name = body.name.trim();
  if (body.voiceProfile !== undefined) updates.voiceProfile = body.voiceProfile;

  const db = getDb();
  const [updated] = await db
    .update(brands)
    .set(updates)
    .where(and(eq(brands.id, brandId), eq(brands.organizationId, orgId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ brand: updated });
}
