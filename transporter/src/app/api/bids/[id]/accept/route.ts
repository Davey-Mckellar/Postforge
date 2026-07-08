import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { awards, bids, capacityOffers, shipments } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { chainInfo, counterparty } from "@/lib/bids/chain";

/**
 * Accepting a bid is the marketplace's commit point:
 *   - target bid -> accepted
 *   - sibling bids on the same posting (including other chain tips) -> rejected
 *   - shipment -> awarded (or capacity -> matched)
 *   - insert awards row (paymentStatus = not_implemented until Phase 2)
 *
 * Authorization: the current bid's counterparty accepts. In a counter chain
 * the "counterparty" is derived from the chain root's bidderId, not the
 * current bid's bidderId — a sender's counter still has to be accepted by
 * the original transporter, not by the sender themselves.
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

  const { rootBidderId } = await chainInfo(bidId);

  let posterId: string;
  let awardSenderId: string;
  let awardTransporterId: string;

  if (bid.shipmentId) {
    const [shipment] = await db
      .select({ senderId: shipments.senderId })
      .from(shipments)
      .where(eq(shipments.id, bid.shipmentId))
      .limit(1);
    if (!shipment) return NextResponse.json({ error: "shipment_not_found" }, { status: 404 });
    posterId = shipment.senderId;
    // Shipment postings: sender is the poster; transporter is the chain root's bidder.
    awardSenderId = posterId;
    awardTransporterId = rootBidderId;
  } else if (bid.capacityOfferId) {
    const [offer] = await db
      .select({ transporterId: capacityOffers.transporterId })
      .from(capacityOffers)
      .where(eq(capacityOffers.id, bid.capacityOfferId))
      .limit(1);
    if (!offer) return NextResponse.json({ error: "capacity_not_found" }, { status: 404 });
    posterId = offer.transporterId;
    // Capacity postings: transporter is the poster; sender is the chain root's bidder.
    awardSenderId = rootBidderId;
    awardTransporterId = posterId;
  } else {
    return NextResponse.json({ error: "bid_has_no_parent" }, { status: 500 });
  }

  const allowedAcceptor = counterparty(posterId, rootBidderId, bid.bidderId);
  if (allowedAcceptor !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const award = await db.transaction(async (tx) => {
    await tx.update(bids).set({ status: "accepted" }).where(eq(bids.id, bidId));

    if (bid.shipmentId) {
      await tx
        .update(bids)
        .set({ status: "rejected" })
        .where(
          and(eq(bids.shipmentId, bid.shipmentId), ne(bids.id, bidId), eq(bids.status, "open")),
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
        shipmentId: bid.shipmentId ?? undefined,
        capacityOfferId: bid.capacityOfferId ?? undefined,
        bidId,
        senderId: awardSenderId,
        transporterId: awardTransporterId,
        agreedPrice: bid.amount,
      })
      .returning();

    return created;
  });

  return NextResponse.json({ award }, { status: 201 });
}
