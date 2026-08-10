import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { getRankedPlayers, clearScoreRowsCache } from "@/lib/queries/players";
import { createTestDb, type TestDb } from "@/lib/test/harness";
import {
  seedPlayerScores,
  seedPlayers,
  seedPositions,
} from "@/lib/test/seed";

describe("getFantasyPositionRankMap", () => {
  let testDb: TestDb;

  before(async () => {
    testDb = await createTestDb();
    await seedPositions(testDb);
  });

  it("returns same position ranks for scoped vs unscoped queries", async () => {
    // Seed 5 QBs with different point totals
    const players = await seedPlayers(testDb, [
      { fullName: "QB1", primaryPositionId: "QB" },
      { fullName: "QB2", primaryPositionId: "QB" },
      { fullName: "QB3", primaryPositionId: "QB" },
      { fullName: "QB4", primaryPositionId: "QB" },
      { fullName: "QB5", primaryPositionId: "QB" },
    ]);

    // Seed scores for these players in week 1
    await seedPlayerScores(testDb, {
      season: "2025",
      week: 1,
      kind: "projection",
      scores: [
        {
          playerId: players[0]!.id,
          ptsPpr: 25.0,
          stats: { pass_yd: 250, pass_att: 30 },
        },
        {
          playerId: players[1]!.id,
          ptsPpr: 20.0,
          stats: { pass_yd: 200, pass_att: 25 },
        },
        {
          playerId: players[2]!.id,
          ptsPpr: 15.0,
          stats: { pass_yd: 150, pass_att: 20 },
        },
        {
          playerId: players[3]!.id,
          ptsPpr: 10.0,
          stats: { pass_yd: 100, pass_att: 15 },
        },
        {
          playerId: players[4]!.id,
          ptsPpr: 5.0,
          stats: { pass_yd: 50, pass_att: 10 },
        },
      ],
    });

    clearScoreRowsCache();

    // Get all players (unscoped)
    const allPlayers = await getRankedPlayers({
      season: "2025",
      week: 1,
      kind: "projection",
      scoringPreset: "full_ppr",
    });

    // Get subset of players (scoped)
    const scopedPlayers = await getRankedPlayers({
      season: "2025",
      week: 1,
      kind: "projection",
      scoringPreset: "full_ppr",
      playerIds: [players[1]!.id, players[3]!.id], // QB2 and QB4
    });

    // Verify QB2 has rank 2 in both queries
    const qb2All = allPlayers.find((p) => p.id === players[1]!.id);
    const qb2Scoped = scopedPlayers.find((p) => p.id === players[1]!.id);
    assert.equal(qb2All?.positionRank, 2);
    assert.equal(qb2Scoped?.positionRank, 2);

    // Verify QB4 has rank 4 in both queries
    const qb4All = allPlayers.find((p) => p.id === players[3]!.id);
    const qb4Scoped = scopedPlayers.find((p) => p.id === players[3]!.id);
    assert.equal(qb4All?.positionRank, 4);
    assert.equal(qb4Scoped?.positionRank, 4);
  });

  it("caches rank map across multiple scoped calls in same request", async () => {
    // Seed 3 RBs
    const players = await seedPlayers(testDb, [
      { fullName: "RB1", primaryPositionId: "RB" },
      { fullName: "RB2", primaryPositionId: "RB" },
      { fullName: "RB3", primaryPositionId: "RB" },
    ]);

    await seedPlayerScores(testDb, {
      season: "2025",
      week: 2,
      kind: "stats",
      scores: [
        {
          playerId: players[0]!.id,
          ptsPpr: 30.0,
          stats: { rush_yd: 300, rush_att: 20 },
        },
        {
          playerId: players[1]!.id,
          ptsPpr: 20.0,
          stats: { rush_yd: 200, rush_att: 15 },
        },
        {
          playerId: players[2]!.id,
          ptsPpr: 10.0,
          stats: { rush_yd: 100, rush_att: 10 },
        },
      ],
    });

    clearScoreRowsCache();

    // Make multiple scoped calls - should all use cached rank map
    const [call1, call2, call3] = await Promise.all([
      getRankedPlayers({
        season: "2025",
        week: 2,
        kind: "stats",
        scoringPreset: "full_ppr",
        playerIds: [players[0]!.id],
      }),
      getRankedPlayers({
        season: "2025",
        week: 2,
        kind: "stats",
        scoringPreset: "full_ppr",
        playerIds: [players[1]!.id],
      }),
      getRankedPlayers({
        season: "2025",
        week: 2,
        kind: "stats",
        scoringPreset: "full_ppr",
        playerIds: [players[2]!.id],
      }),
    ]);

    // All should have correct league-wide ranks
    assert.equal(call1[0]?.positionRank, 1);
    assert.equal(call2[0]?.positionRank, 2);
    assert.equal(call3[0]?.positionRank, 3);
  });
});
