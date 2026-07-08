import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bids } from "@/lib/db/schema";

export type ChainInfo = {
  rootBidderId: string;
  chainIds: string[]; // root -> ... -> current bid, in insertion order
};

/**
 * Walk parentBidId upward from `bidId` to the chain root. In a counter chain,
 * the root's `bidderId` identifies the "external party" — the transporter on
 * a shipment posting, or the sender on a capacity posting. That party plus
 * the posting owner are the two chain participants; every other user is a
 * bystander for that chain.
 */
export async function chainInfo(bidId: string): Promise<ChainInfo> {
  const [start] = await db.select().from(bids).where(eq(bids.id, bidId)).limit(1);
  if (!start) throw new Error("bid_not_found");

  const path: string[] = [start.id];
  let cursor = start;
  const seen = new Set<string>([start.id]);
  while (cursor.parentBidId) {
    const [next] = await db.select().from(bids).where(eq(bids.id, cursor.parentBidId)).limit(1);
    if (!next || seen.has(next.id)) break;
    seen.add(next.id);
    path.push(next.id);
    cursor = next;
  }
  return { rootBidderId: cursor.bidderId, chainIds: path.reverse() };
}

/**
 * The two chain participants and the counterparty of a given bid within the
 * chain. `counterpartyOf(bidderId)` returns whichever participant is NOT the
 * bidder — that's who is allowed to accept or counter this bid.
 */
export function counterparty(
  posterId: string,
  rootBidderId: string,
  bidderId: string,
): string {
  if (bidderId === posterId) return rootBidderId;
  if (bidderId === rootBidderId) return posterId;
  // Bidder is neither participant — shouldn't happen for a well-formed chain.
  // Fall back to poster so accept fails safe with a forbidden error.
  return posterId;
}
