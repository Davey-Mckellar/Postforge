import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bids } from "@/lib/db/schema";

/**
 * Lazy expiry sweep. Call before any read of the bids for a given scope
 * (shipment or capacity offer) so consumers never see stale `open` rows
 * whose `expires_at` has passed. Idempotent, safe to call from every read.
 * Phase 2 can add a background cron for capacity-heavy shipments; Phase 1.5
 * doesn't need one — the sweep is one UPDATE with an indexed WHERE clause
 * and only touches rows for the scope the caller was about to read anyway.
 */
export async function expireStaleBids(
  scope: { shipmentId: string } | { capacityOfferId: string },
): Promise<void> {
  const scopeClause =
    "shipmentId" in scope
      ? eq(bids.shipmentId, scope.shipmentId)
      : eq(bids.capacityOfferId, scope.capacityOfferId);

  await db
    .update(bids)
    .set({ status: "expired" })
    .where(
      and(
        eq(bids.status, "open"),
        isNotNull(bids.expiresAt),
        lt(bids.expiresAt, sql`NOW()`),
        scopeClause,
      ),
    );
}
