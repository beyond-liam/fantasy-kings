import { config } from "dotenv";

config({ path: ".env.local" });

/** Prefer direct Postgres for one-off seeds (pooler often ECONNRESETs). */
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
