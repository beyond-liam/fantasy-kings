import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

/**
 * Runtime must use the Supabase **transaction pooler** (`DATABASE_URL`,
 * port 6543). `DIRECT_URL` (port 5432) is for drizzle-kit migrate/push only.
 */
const connectionString =
  process.env.DATABASE_URL ?? process.env.DIRECT_URL!;

const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined;
  connectionString: string | undefined;
};

/**
 * Supabase free tier session pool is small (~15). Default postgres.js
 * `max: 10` plus Next HMR / parallel RSC queries exhausts it fast.
 * Transaction pooler + `max: 1` + `prepare: false` is the safe free-tier shape.
 */
const client =
  globalForDb.connectionString === connectionString && globalForDb.client
    ? globalForDb.client
    : postgres(connectionString, {
        max: 1,
        prepare: false,
        ssl: "require",
      });

if (process.env.NODE_ENV !== "production") {
  globalForDb.client = client;
  globalForDb.connectionString = connectionString;
}

export let db = drizzle(client, { schema });

/** Test-only: swap the db instance (PGlite harness). Never call from app code. */
export function __setDbForTest(next: typeof db) {
  db = next;
}
