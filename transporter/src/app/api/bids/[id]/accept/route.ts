import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { awards, bids, capacityOffers, shipments } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";

/**
 * Accepting a bid is the marketplace's commit point:
 *   - target bid -> accepted
 *   - sibling bids on the same posting -> rejected
 *   - shipment -> awarded (or capacity -> matched)
 *   - insert awards row (paymentStatus = not_implemented until Phase 2)
 * All four writes happen in one transaction so a crash mid-flow cannot
 * leave the posting in a half-accepted state.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: bidId } = await params;

  const [bid] = await db.select().from(bids).where(eq(bids.id, bidId)).limit(1);
  if (!bid) return NextResponse.json({ error: "bid_not_found" }, { status: 404 });
  if (bid.status !== "open") {
    return NextResponse.json({ error: "bid_not_open" }, { status: 409 });
  }

  let senderId: string;
  let transporterId: string;
  let counterpartyId: string;

  if (bid.shipmentId) {
    const [shipment] = await db
      .select()
      .from(shipments)
      .where(eq(shipments.id, bid.shipmentId))
      .limit(1);
    if (!shipment) return NextResponse.json({ error: "shipment_not_found" }, { status: 404 });
    senderId = shipment.senderId;
    transporterId = bid.bidderId;
    counterpartyId = shipment.senderId;
  } else if (bid.capacityOfferId) {
    const [offer] = await db
      .select()
      .from(capacityOffers)
      .where(eq(capacityOffers.id, bid.capacityOfferId))
      .limit(1);
    if (!offer) return NextResponse.json({ error: "capacity_not_found" }, { status: 404 });
    senderId = bid.bidderId;
    transporterId = offer.transporterId;
    counterpartyId = offer.transporterId;
  } else {
    return NextResponse.json({ error: "bid_has_no_parent" }, { status: 500 });
  }

  // Only the counterparty of the posting can accept a bid on it.
  if (counterpartyId !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const award = await db.transaction(async (tx) => {
    await tx.update(bids).set({ status: "accepted" }).where(eq(bids.id, bidId));

    if (bid.shipmentId) {
      await tx
        .update(bids)
        .set({ status: "rejected" })
        .where(
          and(
            eq(bids.shipmentId, bid.shipmentId),
            ne(bids.id, bidId),
            eq(bids.status, "open"),
          ),
        );
      await tx.update(shipments).set({ status: "awarded" }).where(eq(shipments.id, bid.shipmentId));
    } else if (bid.capacityOfferId) {
      await tx
        .update(bids)
        .set({ status: "rejected" })
        .where(
          and(
            eq(bids.capacityOfferId, bid.capacityOfferId),
            ne(bids.id, bidId),
            eq(bids.status, "open"),
          ),
        );
      await tx
        .update(capacityOffers)
        .set({ status: "matched" })
        .where(eq(capacityOffers.id, bid.capacityOfferId));
    }

    const [created] = await tx
      .insert(awards)
      .values({
        shipmentId: bid.shipmentId ?? undefined!,
        capacityOfferId: bid.capacityOfferId ?? undefined,
        bidId,
        senderId,
        transporterId,
        agreedPrice: bid.amount,
      })
      .returning();

    return created;
  });

  return NextResponse.json({ award }, { status: 201 });
}
