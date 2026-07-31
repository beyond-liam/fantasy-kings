import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { eq, sql } from "drizzle-orm";

import { profiles } from "@/db/schema";
import { recordUserHeartbeat } from "@/lib/presence/heartbeat";
import { createTestDb, type TestDb } from "@/lib/test/harness";
import { seedProfile } from "@/lib/test/seed";

async function readLastSeenAt(testDb: TestDb, userId: string) {
  const [row] = await testDb
    .select({ lastSeenAt: profiles.lastSeenAt })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return row!.lastSeenAt;
}

describe("recordUserHeartbeat", () => {
  let testDb: TestDb;

  before(async () => {
    testDb = await createTestDb();
  });

  it("skips the write while the stored timestamp is fresh", async () => {
    const { id } = await seedProfile(testDb);
    const before = await readLastSeenAt(testDb, id);

    const wrote = await recordUserHeartbeat(id);

    assert.equal(wrote, false);
    assert.deepEqual(await readLastSeenAt(testDb, id), before);
  });

  it("writes once the throttle window has elapsed", async () => {
    const { id } = await seedProfile(testDb);
    await testDb
      .update(profiles)
      .set({ lastSeenAt: sql`now() - interval '10 minutes'` })
      .where(eq(profiles.id, id));
    const before = await readLastSeenAt(testDb, id);

    const wrote = await recordUserHeartbeat(id);

    assert.equal(wrote, true);
    const after = await readLastSeenAt(testDb, id);
    assert.ok(after.getTime() > before.getTime());
  });
});
