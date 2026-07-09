import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { awards, bids, shipments, users } from "@/lib/db/schema";
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

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();

  const [shipment] = await db.select().from(shipments).where(eq(shipments.id, id)).limit(1);
  if (!shipment) notFound();

  await expireStaleBids({ shipmentId: id });

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
    .where(eq(bids.shipmentId, id))
    .orderBy(desc(bids.createdAt));

  // The bidderId FK guarantees the user row exists, but a leftJoin still
  // widens `bidderTier` to nullable. Default to 'unverified' for the type.
  const bidRows: BidRow[] = bidJoin.map((r) => ({
    ...r,
    bidderTier: r.bidderTier ?? "unverified",
  }));

  // Chain-root bidderId + past-award count per bidder (cheap fan-out for
  // Phase 1.5; batch this in Phase 2 if the list grows).
  const uniqueBidders = [...new Set(bidRows.map((b) => b.bidderId))];
  const bidderStats = new Map<string, number>();
  for (const uid of uniqueBidders) bidderStats.set(uid, await pastAwardCount(uid));

  const tree = buildBidTree(bidRows);
  const isSender = user?.id === shipment.senderId;
  const canBid =
    user && !isSender && (shipment.status === "open" || shipment.status === "bidding");

  // Chain roots — external party is the root's bidderId. Used to decide who
  // can counter a given bid.
  const chainRoots = new Map<string, string>(); // bid.id -> chain root bidderId
  function fillChainRoots(node: BidNode<BidRow>, rootBidderId: string) {
    chainRoots.set(node.id, rootBidderId);
    for (const c of node.children) fillChainRoots(c, rootBidderId);
  }
  for (const root of tree) fillChainRoots(root, root.bidderId);

  return (
    <div className="space-y-6">
      <header className="rounded border border-neutral-200 bg-white p-4">
        <div className="text-sm text-neutral-500">Shipment</div>
        <h1 className="mt-1 text-lg font-semibold">
          {shipment.origin} → {shipment.destination}
        </h1>
        <div className="mt-2 grid gap-2 text-sm text-neutral-700 sm:grid-cols-2">
          <div>Status: {shipment.status}</div>
          <div>Target price: ${shipment.targetPrice ?? "—"}</div>
          <div>Weight: {shipment.weightKg ?? "?"} kg</div>
          <div>Declared value: ${shipment.declaredValue ?? "—"}</div>
          <div className="sm:col-span-2">Cargo: {shipment.cargoDescription ?? "—"}</div>
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
                shipmentId={id}
                shipmentSenderId={shipment.senderId}
                chainRootBidderId={root.bidderId}
                currentUserId={user?.id ?? null}
                bidderStats={bidderStats}
              />
            ))}
          </ul>
        )}
      </section>

      {canBid && <BidForm shipmentId={id} />}

      {isSender && (
        <p className="text-sm text-neutral-500">
          You&apos;re the sender on this shipment — accept a bid to award it, or counter one to
          bargain.
        </p>
      )}
      {!user && (
        <p className="text-sm text-neutral-500">
          <a className="underline" href="/signin">
            Sign in
          </a>{" "}
          to bid.
        </p>
      )}
    </div>
  );
}

function BidThread({
  node,
  depth,
  shipmentId,
  shipmentSenderId,
  chainRootBidderId,
  currentUserId,
  bidderStats,
}: {
  node: BidNode<BidRow>;
  depth: number;
  shipmentId: string;
  shipmentSenderId: string;
  chainRootBidderId: string;
  currentUserId: string | null;
  bidderStats: Map<string, number>;
}) {
  // The counterparty of the current bid — that's who can accept OR counter.
  // In a counter chain, ownership flips each hop, so the sender accepts a
  // transporter's bid but the transporter accepts the sender's counter.
  const counterpartyId = counterparty(shipmentSenderId, chainRootBidderId, node.bidderId);
  const canAccept = currentUserId === counterpartyId && node.status === "open";
  const canWithdraw = currentUserId === node.bidderId && node.status === "open";
  const canCounter = currentUserId === counterpartyId && node.status === "open";
  const stats = bidderStats.get(node.bidderId) ?? 0;
  // Sealed bidding: only the posting owner (who must compare offers to
  // accept/counter) and the bid's own bidder see its amount. Everyone else
  // — other bidders, signed-out visitors — sees that a bid exists but not
  // its terms, so competing bidders can't read and undercut each other.
  const canSeeAmount = currentUserId === shipmentSenderId || currentUserId === node.bidderId;

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
          {canAccept && <AcceptButton bidId={node.id} shipmentId={shipmentId} />}
          {canWithdraw && <WithdrawButton bidId={node.id} shipmentId={shipmentId} />}
          {canCounter && <CounterDetails bidId={node.id} shipmentId={shipmentId} />}
        </div>
      </div>
      {node.children.length > 0 && (
        <ul className="mt-2 space-y-2">
          {node.children.map((c) => (
            <BidThread
              key={c.id}
              node={c}
              depth={depth + 1}
              shipmentId={shipmentId}
              shipmentSenderId={shipmentSenderId}
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

function BidForm({ shipmentId }: { shipmentId: string }) {
  async function placeBid(formData: FormData) {
    "use server";
    const user = await requireSessionUser();
    const amount = String(formData.get("amount") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim() || undefined;
    const ttlHours = Number(formData.get("ttlHours") ?? "0");
    if (!amount) throw new Error("amount_required");

    const [shipment] = await db
      .select({ senderId: shipments.senderId, status: shipments.status })
      .from(shipments)
      .where(eq(shipments.id, shipmentId))
      .limit(1);
    if (!shipment) throw new Error("shipment_not_found");
    if (shipment.senderId === user.id) throw new Error("cannot_bid_on_own_shipment");
    if (shipment.status !== "open" && shipment.status !== "bidding") {
      throw new Error("shipment_not_biddable");
    }

    await db.insert(bids).values({
      shipmentId,
      bidderId: user.id,
      amount,
      message,
      expiresAt: ttlHours > 0 ? new Date(Date.now() + ttlHours * 3600 * 1000) : undefined,
    });

    if (shipment.status === "open") {
      await db.update(shipments).set({ status: "bidding" }).where(eq(shipments.id, shipmentId));
    }
    revalidatePath(`/shipments/${shipmentId}`);
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

function CounterDetails({ bidId, shipmentId }: { bidId: string; shipmentId: string }) {
  async function counter(formData: FormData) {
    "use server";
    const user = await requireSessionUser();
    const amount = String(formData.get("amount") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim() || undefined;
    if (!amount) throw new Error("amount_required");

    const [bid] = await db.select().from(bids).where(eq(bids.id, bidId)).limit(1);
    if (!bid || bid.status !== "open") throw new Error("bid_not_open");

    // Chain-root walk to establish who's allowed to counter this bid.
    let root = bid;
    const seen = new Set<string>([bid.id]);
    while (root.parentBidId) {
      const [next] = await db.select().from(bids).where(eq(bids.id, root.parentBidId)).limit(1);
      if (!next || seen.has(next.id)) break;
      seen.add(next.id);
      root = next;
    }

    const [shipment] = await db
      .select({ senderId: shipments.senderId })
      .from(shipments)
      .where(eq(shipments.id, shipmentId))
      .limit(1);
    if (!shipment) throw new Error("shipment_not_found");

    const allowed = new Set<string>([shipment.senderId, root.bidderId]);
    if (!allowed.has(user.id)) throw new Error("forbidden");
    if (user.id === bid.bidderId) throw new Error("cannot_counter_own_bid");

    await db.transaction(async (tx) => {
      await tx.update(bids).set({ status: "countered" }).where(eq(bids.id, bidId));
      await tx.insert(bids).values({
        shipmentId,
        bidderId: user.id,
        amount,
        message,
        parentBidId: bidId,
      });
    });

    revalidatePath(`/shipments/${shipmentId}`);
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

function AcceptButton({ bidId, shipmentId }: { bidId: string; shipmentId: string }) {
  async function accept() {
    "use server";
    const user = await requireSessionUser();

    const [bid] = await db.select().from(bids).where(eq(bids.id, bidId)).limit(1);
    if (!bid || bid.status !== "open" || !bid.shipmentId) throw new Error("bid_not_acceptable");

    const [shipment] = await db
      .select()
      .from(shipments)
      .where(eq(shipments.id, bid.shipmentId))
      .limit(1);
    if (!shipment) throw new Error("shipment_not_found");

    const { rootBidderId } = await chainInfo(bidId);
    const allowedAcceptor = counterparty(shipment.senderId, rootBidderId, bid.bidderId);
    if (allowedAcceptor !== user.id) throw new Error("forbidden");

    const [award] = await db.transaction(async (tx) => {
      await tx.update(bids).set({ status: "accepted" }).where(eq(bids.id, bidId));
      await tx
        .update(bids)
        .set({ status: "rejected" })
        .where(
          and(eq(bids.shipmentId, bid.shipmentId!), ne(bids.id, bidId), eq(bids.status, "open")),
        );
      await tx
        .update(shipments)
        .set({ status: "awarded" })
        .where(eq(shipments.id, bid.shipmentId!));
      return tx
        .insert(awards)
        .values({
          shipmentId: bid.shipmentId!,
          bidId,
          senderId: shipment.senderId,
          transporterId: rootBidderId,
          agreedPrice: bid.amount,
        })
        .returning();
    });

    revalidatePath(`/shipments/${shipmentId}`);
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

function WithdrawButton({ bidId, shipmentId }: { bidId: string; shipmentId: string }) {
  async function withdraw() {
    "use server";
    const user = await requireSessionUser();
    const [bid] = await db.select().from(bids).where(eq(bids.id, bidId)).limit(1);
    if (!bid || bid.bidderId !== user.id || bid.status !== "open") {
      throw new Error("cannot_withdraw");
    }
    await db.update(bids).set({ status: "withdrawn" }).where(eq(bids.id, bidId));
    revalidatePath(`/shipments/${shipmentId}`);
  }

  return (
    <form action={withdraw}>
      <button className="rounded border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100">
        Withdraw
      </button>
    </form>
  );
}
