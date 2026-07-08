import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bids, capacityOffers } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";

const bidInput = z.object({
  amount: z.string().min(1),
  message: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db
    .select()
    .from(bids)
    .where(eq(bids.capacityOfferId, id))
    .orderBy(desc(bids.createdAt));
  return NextResponse.json({ bids: rows });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: capacityOfferId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = bidInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [offer] = await db
    .select({
      id: capacityOffers.id,
      transporterId: capacityOffers.transporterId,
      status: capacityOffers.status,
    })
    .from(capacityOffers)
    .where(eq(capacityOffers.id, capacityOfferId))
    .limit(1);
  if (!offer) return NextResponse.json({ error: "capacity_not_found" }, { status: 404 });
  if (offer.transporterId === user.id) {
    return NextResponse.json({ error: "cannot_bid_on_own_capacity" }, { status: 403 });
  }
  if (offer.status !== "open") {
    return NextResponse.json({ error: "capacity_not_biddable" }, { status: 409 });
  }

  const [created] = await db
    .insert(bids)
    .values({
      capacityOfferId,
      bidderId: user.id,
      amount: parsed.data.amount,
      message: parsed.data.message,
    })
    .returning();

  return NextResponse.json({ bid: created }, { status: 201 });
}
