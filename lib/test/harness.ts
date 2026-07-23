import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "@/db/schema";
import { __setDbForTest, db as appDb } from "@/lib/db";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Spin up an in-memory PGlite Postgres with the app schema pushed, and
 * redirect `lib/db`'s `db` export at it so domain modules read/write here.
 */
export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const testDb = drizzle(client, { schema });
  const { pushSchema } = await import("drizzle-kit/api");
  const { apply } = await pushSchema(schema, testDb as never);
  await apply();
  __setDbForTest(testDb as unknown as typeof appDb);
  return testDb;
}
