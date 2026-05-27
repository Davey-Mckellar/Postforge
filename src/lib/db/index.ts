import "@/lib/postgres-env-sync";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "@/lib/db/schema";

export type AppDatabase = PostgresJsDatabase<typeof schema>;

let singleton: AppDatabase | undefined;

/**
 * Drizzle instance — call only when `POSTGRES_URL` or `DATABASE_URL` is set (Postgres persistence).
 * Uses `postgres` + `postgres-js` so Neon direct URLs work; `@vercel/postgres` rejects non-pooled hosts.
 */
export function getDb(): AppDatabase {
  if (!singleton) {
    const rawUrl =
      process.env.DATABASE_URL?.trim() ||
      process.env.POSTGRES_URL?.trim();
    if (!rawUrl) {
      throw new Error(
        "Database URL missing: set POSTGRES_URL or DATABASE_URL for Postgres persistence.",
      );
    }
    // Strip channel_binding param — not supported by postgres.js / PgBouncer and causes
    // connection failures on Neon pooler URLs injected by the Vercel integration.
    const url = rawUrl
      .replace(/([?&])channel_binding=[^&]*/g, (_, sep) => sep === "?" ? "?" : "")
      .replace(/\?&/, "?")
      .replace(/\?$/, "");
    const client = postgres(url, {
      ssl: "require",
      // Neon pooler (PgBouncer) does not support prepared statements.
      // Without this, every query fails with "prepared statement does not exist".
      prepare: false,
      max: 10,
    });
    singleton = drizzle(client, { schema });
  }
  return singleton;
}

export { schema };

export {
  organizations,
  brands,
  aiRuns,
  aiUsageLedger,
  contentBatches,
  drafts,
  scheduledPosts,
  type OrganizationRow,
  type OrganizationInsert,
  type BrandRow,
  type BrandInsert,
  type AiRunRow,
  type AiRunInsert,
  type AiUsageLedgerRow,
  type AiUsageLedgerInsert,
  type ContentBatchRow,
  type ContentBatchInsert,
  type DraftRow,
  type DraftInsert,
  type ScheduledPostRow,
  type ScheduledPostInsert,
} from "@/lib/db/schema";
