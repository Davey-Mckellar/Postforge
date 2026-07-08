import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { awards, bids, capacityOffers, users } from "@/lib/db/schema";
import { getSessionUser, requireSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CapacityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();

  const [offer] = await db.select().from(capacityOffers).where(eq(capacityOffers.id, id)).limit(1);
  if (!offer) notFound();

  const bidRows = await db
    .select({
      id: bids.id,
      amount: bids.amount,
      message: bids.message,
      status: bids.status,
      bidderId: bids.bidderId,
      bidderName: users.name,
      createdAt: bids.createdAt,
    })
    .from(bids)
    .leftJoin(users, eq(bids.bidderId, users.id))
    .where(eq(bids.capacityOfferId, id))
    .orderBy(desc(bids.createdAt));

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
        {bidRows.length === 0 ? (
          <p className="text-sm text-neutral-500">No bids yet.</p>
        ) : (
          <ul className="space-y-2">
            {bidRows.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between rounded border border-neutral-200 bg-white p-3"
              >
                <div>
                  <div className="text-sm font-medium">
                    ${b.amount} <span className="text-neutral-400">·</span>{" "}
                    <span className="text-neutral-600">{b.bidderName ?? b.bidderId}</span>
                  </div>
                  <div className="text-xs text-neutral-500">
                    status: {b.status}
                    {b.message ? ` · ${b.message}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isTransporter && b.status === "open" && (
                    <AcceptButton bidId={b.id} capacityId={id} />
                  )}
                  {user?.id === b.bidderId && b.status === "open" && (
                    <WithdrawButton bidId={b.id} capacityId={id} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canBid && <BidForm capacityId={id} />}
      {isTransporter && (
        <p className="text-sm text-neutral-500">
          You&apos;re the transporter on this offer — accept a bid to lock in the match.
        </p>
      )}
    </div>
  );
}

function BidForm({ capacityId }: { capacityId: string }) {
  async function placeBid(formData: FormData) {
    "use server";
    const user = await requireSessionUser();
    const amount = String(formData.get("amount") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim() || undefined;
    if (!amount) throw new Error("amount_required");

    const [offer] = await db
      .select({ transporterId: capacityOffers.transporterId, status: capacityOffers.status })
      .from(capacityOffers)
      .where(eq(capacityOffers.id, capacityId))
      .limit(1);
    if (!offer) throw new Error("capacity_not_found");
    if (offer.transporterId === user.id) throw new Error("cannot_bid_on_own_capacity");
    if (offer.status !== "open") throw new Error("capacity_not_biddable");

    await db.insert(bids).values({ capacityOfferId: capacityId, bidderId: user.id, amount, message });
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
    if (offer.transporterId !== user.id) throw new Error("forbidden");

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
          shipmentId: bid.shipmentId ?? undefined!,
          capacityOfferId: bid.capacityOfferId!,
          bidId,
          senderId: bid.bidderId,
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
