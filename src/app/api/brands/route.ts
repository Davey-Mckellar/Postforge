import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/index";
import { brands } from "@/lib/db/schema";

export const runtime = "nodejs";

/** GET /api/brands — list all brands for the org */
export async function GET(req: NextRequest) {
  const orgId = req.headers.get("x-organization-id");
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const rows = await db
    .select()
    .from(brands)
    .where(eq(brands.organizationId, orgId));

  return NextResponse.json({ brands: rows });
}

/** POST /api/brands — create a brand */
export async function POST(req: NextRequest) {
  const orgId = req.headers.get("x-organization-id");
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; voiceProfile?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const db = getDb();
  const [brand] = await db
    .insert(brands)
    .values({ organizationId: orgId, name, voiceProfile: body.voiceProfile ?? null })
    .returning();

  return NextResponse.json({ brand }, { status: 201 });
}
