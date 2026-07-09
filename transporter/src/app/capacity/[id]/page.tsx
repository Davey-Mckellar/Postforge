import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { awards, bids, capacityOffers, users } from "@/lib/db/schema";
import { getSessionUser, requireSessionUser } from "@/lib/session";
import { expireStaleBids } from "@/lib/bids/expire";
import { buildBidTree, type BidNode } from "@/lib/bids/tree";
import { chainInfo, counterparty } from "@/lib/bids/chain";
import { pastAwardCount } from "@/lib/users/stats";
import VerificationBadge from "@/components/verification-badge";

export const dynamic = "force-dynamic";

type BidRow = {
  id: string;
  parentBidId: string | null;
  amount: string;
  message: string | null;
  status: "open" | "withdrawn" | "countered" | "accepted" | "rejected" | "expired";
  bidderId: string;
  bidderName: string | null;
  bidderTier: "unverified" | "basic" | "verified";
  expiresAt: Date | null;
  createdAt: Date;
};

export default async function CapacityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();

  const [offer] = await db.select().from(capacityOffers).where(eq(capacityOffers.id, id)).limit(1);
  if (!offer) notFound();

  await expireStaleBids({ capacityOfferId: id });

  const bidJoin = await db
    .select({
      id: bids.id,
      parentBidId: bids.parentBidId,
      amount: bids.amount,
      message: bids.message,
      status: bids.status,
      bidderId: bids.bidderId,
      bidderName: users.name,
      bidderTier: users.verificationTier,
      expiresAt: bids.expiresAt,
      createdAt: bids.createdAt,
    })
    .from(bids)
    .leftJoin(users, eq(bids.bidderId, users.id))
    .where(eq(bids.capacityOfferId, id))
    .orderBy(desc(bids.createdAt));

  const bidRows: BidRow[] = bidJoin.map((r) => ({
    ...r,
    bidderTier: r.bidderTier ?? "unverified",
  }));

  const uniqueBidders = [...new Set(bidRows.map((b) => b.bidderId))];
  const bidderStats = new Map<string, number>();
  for (const uid of uniqueBidders) bidderStats.set(uid, await pastAwardCount(uid));

  const tree = buildBidTree(bidRows);
  const isTransporter = user?.id === offer.transporterId;
  const canBid = user && !isTransporter && offer.status === "open";

  return (
    <div className="space-y-6">
      <header className="rounded border border-neutral-200 bg-white p-4">
        <div className="text-sm text-neutral-500">Capacity offer</div>
        <h1 className="mt-1 text-lg font-semibold">
          {offer.origin} → {offer.destination}
        </h1>
        <div className="mt-2 grid gap-2 text-sm text-neutral-700 sm:grid-cols-2">
          <div>Status: {offer.status}</div>
          <div>Asking price: ${offer.askingPrice ?? "—"}</div>
          <div>Capacity: {offer.capacityKg ?? "?"} kg</div>
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Bids</h2>
        {tree.length === 0 ? (
          <p className="text-sm text-neutral-500">No bids yet.</p>
        ) : (
          <ul className="space-y-2">
            {tree.map((root) => (
              <BidThread
                key={root.id}
                node={root}
                depth={0}
                capacityId={id}
                offerTransporterId={offer.transporterId}
                chainRootBidderId={root.bidderId}
                currentUserId={user?.id ?? null}
                bidderStats={bidderStats}
              />
            ))}
          </ul>
        )}
      </section>

      {canBid && <BidForm capacityId={id} />}
      {isTransporter && (
        <p className="text-sm text-neutral-500">
          You&apos;re the transporter on this offer — accept a bid to lock in the match, or
          counter one to bargain.
        </p>
      )}
    </div>
  );
}

function BidThread({
  node,
  depth,
  capacityId,
  offerTransporterId,
  chainRootBidderId,
  currentUserId,
  bidderStats,
}: {
  node: BidNode<BidRow>;
  depth: number;
  capacityId: string;
  offerTransporterId: string;
  chainRootBidderId: string;
  currentUserId: string | null;
  bidderStats: Map<string, number>;
}) {
  const counterpartyId = counterparty(offerTransporterId, chainRootBidderId, node.bidderId);
  const canAccept = currentUserId === counterpartyId && node.status === "open";
  const canWithdraw = currentUserId === node.bidderId && node.status === "open";
  const canCounter = currentUserId === counterpartyId && node.status === "open";
  const stats = bidderStats.get(node.bidderId) ?? 0;
  // Sealed bidding: only the posting owner and the bid's own bidder see its
  // amount — see shipments/[id]/page.tsx for the same rule and rationale.
  const canSeeAmount = currentUserId === offerTransporterId || currentUserId === node.bidderId;

  return (
    <li>
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-200 bg-white p-3"
        style={{ marginLeft: `${depth * 20}px` }}
      >
        <div className="min-w-0">
          <div className="text-sm font-medium">
            {canSeeAmount ? (
              `$${node.amount}`
            ) : (
              <span className="text-neutral-400" title="Bid amount is sealed">
                Sealed
              </span>
            )}{" "}
            <span className="text-neutral-400">·</span>{" "}
            <span className="text-neutral-700">{node.bidderName ?? node.bidderId}</span>{" "}
            <VerificationBadge tier={node.bidderTier} />{" "}
            <span className="ml-1 text-xs text-neutral-500">
              · {stats} past award{stats === 1 ? "" : "s"}
            </span>
          </div>
          <div className="text-xs text-neutral-500">
            status: {node.status}
            {node.expiresAt ? ` · expires ${formatExpiry(node.expiresAt)}` : ""}
            {canSeeAmount && node.message ? ` · ${node.message}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canAccept && <AcceptButton bidId={node.id} capacityId={capacityId} />}
          {canWithdraw && <WithdrawButton bidId={node.id} capacityId={capacityId} />}
          {canCounter && <CounterDetails bidId={node.id} capacityId={capacityId} />}
        </div>
      </div>
      {node.children.length > 0 && (
        <ul className="mt-2 space-y-2">
          {node.children.map((c) => (
            <BidThread
              key={c.id}
              node={c}
              depth={depth + 1}
              capacityId={capacityId}
              offerTransporterId={offerTransporterId}
              chainRootBidderId={chainRootBidderId}
              currentUserId={currentUserId}
              bidderStats={bidderStats}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function formatExpiry(when: Date): string {
  const now = Date.now();
  const ms = when.getTime() - now;
  if (ms <= 0) return "now";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.round(mins / 60);
  return `in ${hrs}h`;
}

function BidForm({ capacityId }: { capacityId: string }) {
  async function placeBid(formData: FormData) {
    "use server";
    const user = await requireSessionUser();
    const amount = String(formData.get("amount") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim() || undefined;
    const ttlHours = Number(formData.get("ttlHours") ?? "0");
    if (!amount) throw new Error("amount_required");

    const [offer] = await db
      .select({ transporterId: capacityOffers.transporterId, status: capacityOffers.status })
      .from(capacityOffers)
      .where(eq(capacityOffers.id, capacityId))
      .limit(1);
    if (!offer) throw new Error("capacity_not_found");
    if (offer.transporterId === user.id) throw new Error("cannot_bid_on_own_capacity");
    if (offer.status !== "open") throw new Error("capacity_not_biddable");

    await db.insert(bids).values({
      capacityOfferId: capacityId,
      bidderId: user.id,
      amount,
      message,
      expiresAt: ttlHours > 0 ? new Date(Date.now() + ttlHours * 3600 * 1000) : undefined,
    });
    revalidatePath(`/capacity/${capacityId}`);
  }

  return (
    <section className="rounded border border-neutral-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold">Place a bid</h3>
      <form action={placeBid} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Amount ($)</label>
          <input
            name="amount"
            required
            className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Message (optional)</label>
          <input
            name="message"
            className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Expires in</label>
          <select
            name="ttlHours"
            defaultValue="0"
            className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1"
          >
            <option value="0">No expiry</option>
            <option value="1">1 hour</option>
            <option value="24">24 hours</option>
            <option value="72">72 hours</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white hover:bg-neutral-800"
        >
          Bid
        </button>
      </form>
    </section>
  );
}

function CounterDetails({ bidId, capacityId }: { bidId: string; capacityId: string }) {
  async function counter(formData: FormData) {
    "use server";
    const user = await requireSessionUser();
    const amount = String(formData.get("amount") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim() || undefined;
    if (!amount) throw new Error("amount_required");

    const [bid] = await db.select().from(bids).where(eq(bids.id, bidId)).limit(1);
    if (!bid || bid.status !== "open") throw new Error("bid_not_open");

    let root = bid;
    const seen = new Set<string>([bid.id]);
    while (root.parentBidId) {
      const [next] = await db.select().from(bids).where(eq(bids.id, root.parentBidId)).limit(1);
      if (!next || seen.has(next.id)) break;
      seen.add(next.id);
      root = next;
    }

    const [offer] = await db
      .select({ transporterId: capacityOffers.transporterId })
      .from(capacityOffers)
      .where(eq(capacityOffers.id, capacityId))
      .limit(1);
    if (!offer) throw new Error("capacity_not_found");

    const allowed = new Set<string>([offer.transporterId, root.bidderId]);
    if (!allowed.has(user.id)) throw new Error("forbidden");
    if (user.id === bid.bidderId) throw new Error("cannot_counter_own_bid");

    await db.transaction(async (tx) => {
      await tx.update(bids).set({ status: "countered" }).where(eq(bids.id, bidId));
      await tx.insert(bids).values({
        capacityOfferId: capacityId,
        bidderId: user.id,
        amount,
        message,
        parentBidId: bidId,
      });
    });

    revalidatePath(`/capacity/${capacityId}`);
  }

  return (
    <details className="text-sm">
      <summary className="cursor-pointer rounded border border-neutral-300 px-3 py-1 hover:bg-neutral-100">
        Counter
      </summary>
      <form action={counter} className="mt-2 space-y-2">
        <input
          name="amount"
          placeholder="Amount"
          required
          className="block w-32 rounded border border-neutral-300 px-2 py-1"
        />
        <input
          name="message"
          placeholder="Message (optional)"
          className="block w-64 rounded border border-neutral-300 px-2 py-1"
        />
        <button className="rounded bg-black px-3 py-1 text-xs text-white hover:bg-neutral-800">
          Send counter
        </button>
      </form>
    </details>
  );
}

function AcceptButton({ bidId, capacityId }: { bidId: string; capacityId: string }) {
  async function accept() {
    "use server";
    const user = await requireSessionUser();
    const [bid] = await db.select().from(bids).where(eq(bids.id, bidId)).limit(1);
    if (!bid || bid.status !== "open" || !bid.capacityOfferId) throw new Error("bid_not_acceptable");

    const [offer] = await db
      .select()
      .from(capacityOffers)
      .where(eq(capacityOffers.id, bid.capacityOfferId))
      .limit(1);
    if (!offer) throw new Error("capacity_not_found");

    const { rootBidderId } = await chainInfo(bidId);
    const allowedAcceptor = counterparty(offer.transporterId, rootBidderId, bid.bidderId);
    if (allowedAcceptor !== user.id) throw new Error("forbidden");

    const [award] = await db.transaction(async (tx) => {
      await tx.update(bids).set({ status: "accepted" }).where(eq(bids.id, bidId));
      await tx
        .update(bids)
        .set({ status: "rejected" })
        .where(
          and(
            eq(bids.capacityOfferId, bid.capacityOfferId!),
            ne(bids.id, bidId),
            eq(bids.status, "open"),
          ),
        );
      await tx
        .update(capacityOffers)
        .set({ status: "matched" })
        .where(eq(capacityOffers.id, bid.capacityOfferId!));
      return tx
        .insert(awards)
        .values({
          capacityOfferId: bid.capacityOfferId!,
          bidId,
          senderId: rootBidderId,
          transporterId: offer.transporterId,
          agreedPrice: bid.amount,
        })
        .returning();
    });

    revalidatePath(`/capacity/${capacityId}`);
    redirect(`/awards/${award.id}`);
  }

  return (
    <form action={accept}>
      <button className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700">
        Accept
      </button>
    </form>
  );
}

function WithdrawButton({ bidId, capacityId }: { bidId: string; capacityId: string }) {
  async function withdraw() {
    "use server";
    const user = await requireSessionUser();
    const [bid] = await db.select().from(bids).where(eq(bids.id, bidId)).limit(1);
    if (!bid || bid.bidderId !== user.id || bid.status !== "open") {
      throw new Error("cannot_withdraw");
    }
    await db.update(bids).set({ status: "withdrawn" }).where(eq(bids.id, bidId));
    revalidatePath(`/capacity/${capacityId}`);
  }

  return (
    <form action={withdraw}>
      <button className="rounded border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100">
        Withdraw
      </button>
    </form>
  );
}
