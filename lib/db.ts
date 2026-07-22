import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;

const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined;
  connectionString: string | undefined;
};

/**
 * Supabase free tier session pool is small (~15). Default postgres.js
 * `max: 10` plus Next HMR / parallel RSC queries exhausts it fast.
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

export const db = drizzle(client, { schema });
