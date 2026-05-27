import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "@/lib/db";
import { organizations } from "@/lib/db/schema";

export const runtime = "nodejs";

/** Internal GET — middleware org activation lookup (x-internal-secret gate). */
export async function GET(request: NextRequest) {
  const secret = process.env.BBGPT_API_SECRET;
  if (!secret || request.headers.get("x-internal-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = request.nextUrl.searchParams.get("userId");

  try {
    const db = getDb();
    const [row] = await db
      .select({ id: organizations.id, activationStatus: organizations.activationStatus })
      .from(organizations)
      .where(eq(organizations.ownerId, userId ?? ""))
      .limit(1);

    if (!row) {
      return NextResponse.json(
        { activationStatus: "PENDING", organizationId: null },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { activationStatus: row.activationStatus, organizationId: row.id },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
