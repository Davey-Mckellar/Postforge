import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { capacityOffers, shipments, users } from "@/lib/db/schema";
import VerificationBadge from "@/components/verification-badge";
import { pastAwardCount } from "@/lib/users/stats";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [openShipments, openCapacity] = await Promise.all([
    db
      .select({
        id: shipments.id,
        origin: shipments.origin,
        destination: shipments.destination,
        targetPrice: shipments.targetPrice,
        weightKg: shipments.weightKg,
        status: shipments.status,
        senderId: shipments.senderId,
        senderName: users.name,
        senderTier: users.verificationTier,
      })
      .from(shipments)
      .leftJoin(users, eq(shipments.senderId, users.id))
      .where(inArray(shipments.status, ["open", "bidding"]))
      .orderBy(desc(shipments.createdAt))
      .limit(25),
    db
      .select({
        id: capacityOffers.id,
        origin: capacityOffers.origin,
        destination: capacityOffers.destination,
        askingPrice: capacityOffers.askingPrice,
        capacityKg: capacityOffers.capacityKg,
        status: capacityOffers.status,
        transporterId: capacityOffers.transporterId,
        transporterName: users.name,
        transporterTier: users.verificationTier,
      })
      .from(capacityOffers)
      .leftJoin(users, eq(capacityOffers.transporterId, users.id))
      .where(inArray(capacityOffers.status, ["open"]))
      .orderBy(desc(capacityOffers.createdAt))
      .limit(25),
  ]);

  const posterIds = new Set<string>([
    ...openShipments.map((s) => s.senderId),
    ...openCapacity.map((c) => c.transporterId),
  ]);
  const awardCounts = new Map<string, number>();
  for (const uid of posterIds) awardCounts.set(uid, await pastAwardCount(uid));

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Open shipments</h2>
        {openShipments.length === 0 ? (
          <p className="text-sm text-neutral-500">No open shipments yet.</p>
        ) : (
          <ul className="space-y-3">
            {openShipments.map((s) => (
              <li key={s.id} className="rounded border border-neutral-200 bg-white p-4">
                <Link href={`/shipments/${s.id}`} className="block">
                  <div className="text-sm font-medium">
                    {s.origin} → {s.destination}
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    target ${s.targetPrice ?? "—"} · {s.weightKg ?? "?"} kg · {s.status}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
                    <span>{s.senderName ?? "—"}</span>
                    {s.senderTier && <VerificationBadge tier={s.senderTier} />}
                    <span className="text-neutral-400">
                      · {awardCounts.get(s.senderId) ?? 0} past
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Open capacity</h2>
        {openCapacity.length === 0 ? (
          <p className="text-sm text-neutral-500">No open capacity offers yet.</p>
        ) : (
          <ul className="space-y-3">
            {openCapacity.map((c) => (
              <li key={c.id} className="rounded border border-neutral-200 bg-white p-4">
                <Link href={`/capacity/${c.id}`} className="block">
                  <div className="text-sm font-medium">
                    {c.origin} → {c.destination}
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    asking ${c.askingPrice ?? "—"} · {c.capacityKg ?? "?"} kg · {c.status}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
                    <span>{c.transporterName ?? "—"}</span>
                    {c.transporterTier && <VerificationBadge tier={c.transporterTier} />}
                    <span className="text-neutral-400">
                      · {awardCounts.get(c.transporterId) ?? 0} past
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
