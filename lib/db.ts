import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

/**
 * Runtime must use the Supabase **transaction pooler** (`DATABASE_URL`,
 * port 6543). `DIRECT_URL` (port 5432) is for drizzle-kit migrate/push only —
 * never fall back to it here (exhausts free-tier session slots under RSC).
 */
function resolveRuntimeDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;

  // `next build` may import server modules without secrets; PGlite dbtests
  // set FK_DB_PLACEHOLDER=1 and immediately swap `db` via `__setDbForTest`.
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.FK_DB_PLACEHOLDER === "1"
  ) {
    return "postgresql://build:build@127.0.0.1:5432/build";
  }

  throw new Error(
    "DATABASE_URL is required (Supabase transaction pooler, port 6543). " +
      "DIRECT_URL is for drizzle-kit migrate/push only — do not use it at runtime.",
  );
}

const connectionString = resolveRuntimeDatabaseUrl();

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
        // Fail fast on dead sockets; recycle before Supabase kills idle clients.
        connect_timeout: 10,
        idle_timeout: 20,
        max_lifetime: 60 * 5,
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
