import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { capacityOffers, shipments } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [openShipments, openCapacity] = await Promise.all([
    db
      .select()
      .from(shipments)
      .where(inArray(shipments.status, ["open", "bidding"]))
      .orderBy(desc(shipments.createdAt))
      .limit(25),
    db
      .select()
      .from(capacityOffers)
      .where(inArray(capacityOffers.status, ["open"]))
      .orderBy(desc(capacityOffers.createdAt))
      .limit(25),
  ]);

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
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
