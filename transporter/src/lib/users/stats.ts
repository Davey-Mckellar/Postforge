import { count, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { awards } from "@/lib/db/schema";

/**
 * Number of awards a user has been on either side of. Cheap enough to call
 * inline from server components; if it grows into a hot path, cache per
 * request in Phase 2.
 */
export async function pastAwardCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(awards)
    .where(or(eq(awards.senderId, userId), eq(awards.transporterId, userId)));
  return Number(row?.n ?? 0);
}
