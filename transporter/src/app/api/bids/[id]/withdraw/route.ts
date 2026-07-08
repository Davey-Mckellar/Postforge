import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bids } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const [bid] = await db.select().from(bids).where(eq(bids.id, id)).limit(1);
  if (!bid) return NextResponse.json({ error: "bid_not_found" }, { status: 404 });
  if (bid.bidderId !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (bid.status !== "open") {
    return NextResponse.json({ error: "bid_not_open" }, { status: 409 });
  }

  const [updated] = await db
    .update(bids)
    .set({ status: "withdrawn" })
    .where(eq(bids.id, id))
    .returning();

  return NextResponse.json({ bid: updated });
}
