import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bids, capacityOffers, shipments } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";

const counterInput = z.object({
  amount: z.string().min(1),
  message: z.string().optional(),
});

/**
 * Counter an open bid.
 *
 * Chain rules:
 *   - The bid being countered must be `open`.
 *   - The counterer must be one of the two chain participants (the posting
 *     owner or the chain root's bidder) and must NOT be the current bid's
 *     bidder (you can't counter your own offer — just post another bid).
 *   - The counter marks the original `countered` and inserts a new open bid
 *     with `parent_bid_id` set. `accept` on any open bid still rejects every
 *     other open bid on the posting, which naturally closes competing chains.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: bidId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = counterInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [bid] = await db.select().from(bids).where(eq(bids.id, bidId)).limit(1);
  if (!bid) return NextResponse.json({ error: "bid_not_found" }, { status: 404 });
  if (bid.status !== "open") return NextResponse.json({ error: "bid_not_open" }, { status: 409 });

  // Walk to the chain root — the first bid in the counter chain, whose bidderId
  // identifies the external party (transporter for shipment-bids, sender for
  // capacity-bids).
  let root = bid;
  const seen = new Set<string>([bid.id]);
  while (root.parentBidId) {
    const [next] = await db.select().from(bids).where(eq(bids.id, root.parentBidId)).limit(1);
    if (!next || seen.has(next.id)) break;
    seen.add(next.id);
    root = next;
  }

  let posterId: string;
  if (bid.shipmentId) {
    const [s] = await db
      .select({ senderId: shipments.senderId })
      .from(shipments)
      .where(eq(shipments.id, bid.shipmentId))
      .limit(1);
    if (!s) return NextResponse.json({ error: "shipment_not_found" }, { status: 404 });
    posterId = s.senderId;
  } else if (bid.capacityOfferId) {
    const [c] = await db
      .select({ transporterId: capacityOffers.transporterId })
      .from(capacityOffers)
      .where(eq(capacityOffers.id, bid.capacityOfferId))
      .limit(1);
    if (!c) return NextResponse.json({ error: "capacity_not_found" }, { status: 404 });
    posterId = c.transporterId;
  } else {
    return NextResponse.json({ error: "bid_has_no_parent" }, { status: 500 });
  }

  const allowedCounterers = new Set<string>([posterId, root.bidderId]);
  if (!allowedCounterers.has(user.id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (user.id === bid.bidderId) {
    return NextResponse.json({ error: "cannot_counter_own_bid" }, { status: 400 });
  }

  const created = await db.transaction(async (tx) => {
    await tx.update(bids).set({ status: "countered" }).where(eq(bids.id, bidId));
    const [inserted] = await tx
      .insert(bids)
      .values({
        shipmentId: bid.shipmentId ?? undefined,
        capacityOfferId: bid.capacityOfferId ?? undefined,
        bidderId: user.id,
        amount: parsed.data.amount,
        message: parsed.data.message,
        parentBidId: bidId,
      })
      .returning();
    return inserted;
  });

  return NextResponse.json({ bid: created }, { status: 201 });
}
