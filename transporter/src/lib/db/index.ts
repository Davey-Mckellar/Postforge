import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// A placeholder URL keeps `next build` happy — the Pool never opens a
// connection at build time; requests error only when a query actually runs.
const url =
  process.env.DATABASE_URL ??
  "postgres://build:build@build.invalid/build?sslmode=disable";

export const pool = new Pool({ connectionString: url });
export const db = drizzle(pool, { schema });
export { schema };
