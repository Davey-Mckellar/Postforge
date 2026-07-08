import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { awards, bids, shipments, users } from "@/lib/db/schema";
import { getSessionUser, requireSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();

  const [shipment] = await db.select().from(shipments).where(eq(shipments.id, id)).limit(1);
  if (!shipment) notFound();

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
    .where(eq(bids.shipmentId, id))
    .orderBy(desc(bids.createdAt));

  const isSender = user?.id === shipment.senderId;
  const canBid = user && !isSender && (shipment.status === "open" || shipment.status === "bidding");

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
                  {isSender && b.status === "open" && (
                    <AcceptButton bidId={b.id} shipmentId={id} />
                  )}
                  {user?.id === b.bidderId && b.status === "open" && (
                    <WithdrawButton bidId={b.id} shipmentId={id} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canBid && <BidForm shipmentId={id} />}

      {isSender && (
        <p className="text-sm text-neutral-500">
          You&apos;re the sender on this shipment — you can accept a bid to award it.
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

function BidForm({ shipmentId }: { shipmentId: string }) {
  async function placeBid(formData: FormData) {
    "use server";
    const user = await requireSessionUser();
    const amount = String(formData.get("amount") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim() || undefined;
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

    await db.insert(bids).values({ shipmentId, bidderId: user.id, amount, message });

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
    if (shipment.senderId !== user.id) throw new Error("forbidden");

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
          transporterId: bid.bidderId,
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
