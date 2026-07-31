import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { eq, sql } from "drizzle-orm";

import { leagueMembers, profiles } from "@/db/schema";
import { getLeaguePresence } from "@/lib/queries/presence";
import { createTestDb, type TestDb } from "@/lib/test/harness";
import { seedLeagueSeason, seedTeams } from "@/lib/test/seed";

describe("getLeaguePresence", () => {
  let testDb: TestDb;

  before(async () => {
    testDb = await createTestDb();
  });

  it("returns status for each league member from last_seen_at", async () => {
    const { leagueId, season } = await seedLeagueSeason(testDb, {
      teamCount: 2,
    });
    const [online, offline] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });

    await testDb.insert(leagueMembers).values([
      { leagueId, userId: online!.userId, role: "commissioner" },
      { leagueId, userId: offline!.userId, role: "member" },
    ]);

    await testDb
      .update(profiles)
      .set({ lastSeenAt: sql`now()` })
      .where(eq(profiles.id, online!.userId));
    await testDb
      .update(profiles)
      .set({ lastSeenAt: sql`now() - interval '10 minutes'` })
      .where(eq(profiles.id, offline!.userId));

    const snapshot = await getLeaguePresence(leagueId);
    const byId = new Map(
      snapshot.members.map((member) => [member.userId, member]),
    );

    assert.equal(byId.get(online!.userId)?.status, "online");
    assert.equal(byId.get(offline!.userId)?.status, "offline");
    assert.ok(snapshot.nflSeasonType);
    assert.ok(snapshot.resolvedAt);
  });
});
