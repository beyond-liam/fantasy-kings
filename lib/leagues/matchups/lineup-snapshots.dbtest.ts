import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import { matchups, playerScores, rosterPlayers } from "@/db/schema";
import { buildStandardRosterSlots } from "@/lib/leagues/defaults";
import { finalizeSeasonWeekMatchups } from "@/lib/leagues/matchups/finalize";
import {
  loadTeamWeekLineup,
  upsertTeamWeekLineup,
} from "@/lib/leagues/matchups/lineup-snapshots";
import { loadTeamWeekGameTieMetrics } from "@/lib/leagues/tiebreakers/load-game-metrics";
import { createTestDb, type TestDb } from "@/lib/test/harness";
import {
  seedLeagueSeason,
  seedMatchup,
  seedPlayerScore,
  seedPlayers,
  seedPositions,
  seedRosterPlayer,
  seedTeams,
} from "@/lib/test/seed";

function seasonFinalizeInput(season: {
  id: string;
  seasonYear: number;
  scoringPreset: string;
}) {
  return {
    id: season.id,
    seasonYear: season.seasonYear,
    regularSeasonEndWeek: 14,
    scoringPreset: season.scoringPreset,
    settings: {
      rosterSlots: buildStandardRosterSlots(6, 0, 0),
      irEligibleStatuses: [] as string[],
    },
    benchSlots: 6,
    irEnabled: false,
    irSlots: 0,
    taxiEnabled: false,
    taxiSlots: 0,
  };
}

describe("lineup snapshots", () => {
  let testDb: TestDb;

  before(async () => {
    testDb = await createTestDb();
    await seedPositions(testDb);
  });

  it("first finalize writes snapshot rows", async () => {
    const { season } = await seedLeagueSeason(testDb, { teamCount: 2 });
    const [home, away] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });
    const [p1, p2] = await seedPlayers(testDb, [
      { fullName: "Player 1", primaryPositionId: "QB" },
      { fullName: "Player 2", primaryPositionId: "RB" },
    ]);

    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: home!.id,
      playerId: p1!.id,
      slotPositionId: "QB",
    });
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: away!.id,
      playerId: p2!.id,
      slotPositionId: "RB",
    });

    await seedPlayerScore(testDb, {
      playerId: p1!.id,
      season: String(season.seasonYear),
      week: 1,
      kind: "stats",
      stats: { pass_yd: 300 },
      ptsPpr: 12,
    });
    await seedPlayerScore(testDb, {
      playerId: p2!.id,
      season: String(season.seasonYear),
      week: 1,
      kind: "stats",
      stats: { rush_yd: 100 },
      ptsPpr: 10,
    });

    const matchup = await seedMatchup(testDb, {
      leagueSeasonId: season.id,
      week: 1,
      homeTeamId: home!.id,
      awayTeamId: away!.id,
      status: "scheduled",
    });

    await finalizeSeasonWeekMatchups({
      season: seasonFinalizeInput(season),
      week: 1,
      currentWeek: 2,
      scoreboardGames: [],
      allowOfficialCorrections: false,
    });

    const [finalMatchup] = await testDb
      .select()
      .from(matchups)
      .where(eq(matchups.id, matchup.id));
    assert.equal(finalMatchup?.status, "final");
    assert.ok((finalMatchup?.homePts ?? 0) > 0);
    assert.ok((finalMatchup?.awayPts ?? 0) > 0);

    const homeSnapshot = await loadTeamWeekLineup({
      leagueSeasonId: season.id,
      teamId: home!.id,
      week: 1,
    });
    const awaySnapshot = await loadTeamWeekLineup({
      leagueSeasonId: season.id,
      teamId: away!.id,
      week: 1,
    });

    assert.ok(homeSnapshot);
    assert.ok(awaySnapshot);
    assert.equal(homeSnapshot.length, 1);
    assert.equal(awaySnapshot.length, 1);
    assert.equal(homeSnapshot[0]!.playerId, p1!.id);
    assert.equal(awaySnapshot[0]!.playerId, p2!.id);
  });

  it("after finalize, mutate live roster; corrections off → pts unchanged", async () => {
    const { season } = await seedLeagueSeason(testDb, { teamCount: 2 });
    const [home, away] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });
    const [p1, p2, p3] = await seedPlayers(testDb, [
      { fullName: "Starter QB", primaryPositionId: "QB" },
      { fullName: "Starter RB", primaryPositionId: "RB" },
      { fullName: "Bench QB", primaryPositionId: "QB" },
    ]);

    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: home!.id,
      playerId: p1!.id,
      slotPositionId: "QB",
    });
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: away!.id,
      playerId: p2!.id,
      slotPositionId: "RB",
    });

    await seedPlayerScore(testDb, {
      playerId: p1!.id,
      season: String(season.seasonYear),
      week: 1,
      kind: "stats",
      stats: { pass_yd: 300 },
      ptsPpr: 12,
    });
    await seedPlayerScore(testDb, {
      playerId: p2!.id,
      season: String(season.seasonYear),
      week: 1,
      kind: "stats",
      stats: { rush_yd: 100 },
      ptsPpr: 10,
    });
    await seedPlayerScore(testDb, {
      playerId: p3!.id,
      season: String(season.seasonYear),
      week: 1,
      kind: "stats",
      stats: { pass_yd: 400 },
      ptsPpr: 16,
    });

    const matchup = await seedMatchup(testDb, {
      leagueSeasonId: season.id,
      week: 1,
      homeTeamId: home!.id,
      awayTeamId: away!.id,
    });

    await finalizeSeasonWeekMatchups({
      season: seasonFinalizeInput(season),
      week: 1,
      currentWeek: 2,
      scoreboardGames: [],
      allowOfficialCorrections: false,
    });

    const [firstFinal] = await testDb
      .select()
      .from(matchups)
      .where(eq(matchups.id, matchup.id));
    const originalHomePts = firstFinal!.homePts;

    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: home!.id,
      playerId: p3!.id,
      slotPositionId: "QB",
    });

    await finalizeSeasonWeekMatchups({
      season: seasonFinalizeInput(season),
      week: 1,
      currentWeek: 2,
      scoreboardGames: [],
      allowOfficialCorrections: false,
    });

    const [afterChange] = await testDb
      .select()
      .from(matchups)
      .where(eq(matchups.id, matchup.id));

    assert.equal(afterChange!.homePts, originalHomePts);
  });

  it("stat change for snapshotted player updates pts when corrections on", async () => {
    const { season } = await seedLeagueSeason(testDb, { teamCount: 2 });
    const [home, away] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });
    const [p1, p2] = await seedPlayers(testDb, [
      { fullName: "QB", primaryPositionId: "QB" },
      { fullName: "RB", primaryPositionId: "RB" },
    ]);

    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: home!.id,
      playerId: p1!.id,
      slotPositionId: "QB",
    });
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: away!.id,
      playerId: p2!.id,
      slotPositionId: "RB",
    });

    await seedPlayerScore(testDb, {
      playerId: p1!.id,
      season: String(season.seasonYear),
      week: 1,
      kind: "stats",
      stats: { pass_yd: 300 },
      ptsPpr: 12,
    });
    await seedPlayerScore(testDb, {
      playerId: p2!.id,
      season: String(season.seasonYear),
      week: 1,
      kind: "stats",
      stats: { rush_yd: 100 },
      ptsPpr: 10,
    });

    const matchup = await seedMatchup(testDb, {
      leagueSeasonId: season.id,
      week: 1,
      homeTeamId: home!.id,
      awayTeamId: away!.id,
    });

    await finalizeSeasonWeekMatchups({
      season: seasonFinalizeInput(season),
      week: 1,
      currentWeek: 2,
      scoreboardGames: [],
      allowOfficialCorrections: true,
    });

    const [firstFinal] = await testDb
      .select()
      .from(matchups)
      .where(eq(matchups.id, matchup.id));
    const originalHomePts = firstFinal!.homePts;
    assert.ok(originalHomePts != null && originalHomePts > 0);

    await testDb
      .update(playerScores)
      .set({
        stats: { pass_yd: 400 },
        ptsPpr: 16,
      })
      .where(eq(playerScores.playerId, p1!.id));

    await finalizeSeasonWeekMatchups({
      season: seasonFinalizeInput(season),
      week: 1,
      currentWeek: 2,
      scoreboardGames: [],
      allowOfficialCorrections: true,
    });

    const [corrected] = await testDb
      .select()
      .from(matchups)
      .where(eq(matchups.id, matchup.id));

    assert.ok(corrected!.homePts! > originalHomePts!);
  });

  it("live roster swap with corrections on does not change pts (uses snapshot)", async () => {
    const { season } = await seedLeagueSeason(testDb, { teamCount: 2 });
    const [home, away] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });
    const [p1, p2, p3] = await seedPlayers(testDb, [
      { fullName: "Orig QB", primaryPositionId: "QB" },
      { fullName: "Opp RB", primaryPositionId: "RB" },
      { fullName: "New QB", primaryPositionId: "QB" },
    ]);

    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: home!.id,
      playerId: p1!.id,
      slotPositionId: "QB",
    });
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: away!.id,
      playerId: p2!.id,
      slotPositionId: "RB",
    });

    await seedPlayerScore(testDb, {
      playerId: p1!.id,
      season: String(season.seasonYear),
      week: 1,
      kind: "stats",
      stats: { pass_yd: 250 },
      ptsPpr: 10,
    });
    await seedPlayerScore(testDb, {
      playerId: p2!.id,
      season: String(season.seasonYear),
      week: 1,
      kind: "stats",
      stats: { rush_yd: 80 },
      ptsPpr: 8,
    });
    await seedPlayerScore(testDb, {
      playerId: p3!.id,
      season: String(season.seasonYear),
      week: 1,
      kind: "stats",
      stats: { pass_yd: 500 },
      ptsPpr: 20,
    });

    const matchup = await seedMatchup(testDb, {
      leagueSeasonId: season.id,
      week: 1,
      homeTeamId: home!.id,
      awayTeamId: away!.id,
    });

    await finalizeSeasonWeekMatchups({
      season: seasonFinalizeInput(season),
      week: 1,
      currentWeek: 2,
      scoreboardGames: [],
      allowOfficialCorrections: true,
    });

    const [firstFinal] = await testDb
      .select()
      .from(matchups)
      .where(eq(matchups.id, matchup.id));
    const originalHomePts = firstFinal!.homePts;

    // Drop original starter; install high-scoring replacement as QB.
    await testDb
      .update(rosterPlayers)
      .set({ status: "waived", slotPositionId: null })
      .where(eq(rosterPlayers.playerId, p1!.id));
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: home!.id,
      playerId: p3!.id,
      slotPositionId: "QB",
    });

    await finalizeSeasonWeekMatchups({
      season: seasonFinalizeInput(season),
      week: 1,
      currentWeek: 2,
      scoreboardGames: [],
      allowOfficialCorrections: true,
    });

    const [afterSwap] = await testDb
      .select()
      .from(matchups)
      .where(eq(matchups.id, matchup.id));

    assert.equal(afterSwap!.homePts, originalHomePts);
  });

  it("loadTeamWeekGameTieMetrics uses frozen lineups when provided", async () => {
    const { season } = await seedLeagueSeason(testDb, { teamCount: 1 });
    const [team] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 1,
    });
    const [starter, bench] = await seedPlayers(testDb, [
      { fullName: "Frozen QB", primaryPositionId: "QB" },
      { fullName: "Live Bench QB", primaryPositionId: "QB" },
    ]);

    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: team!.id,
      playerId: bench!.id,
      slotPositionId: "QB",
    });

    await seedPlayerScore(testDb, {
      playerId: starter!.id,
      season: String(season.seasonYear),
      week: 1,
      kind: "stats",
      stats: { pass_yd: 300 },
      ptsPpr: 12,
    });
    await seedPlayerScore(testDb, {
      playerId: bench!.id,
      season: String(season.seasonYear),
      week: 1,
      kind: "stats",
      stats: { pass_yd: 50 },
      ptsPpr: 2,
    });

    const frozen = new Map([
      [
        team!.id,
        [{ playerId: starter!.id, slotPositionId: "QB" as string | null }],
      ],
    ]);

    const metrics = await loadTeamWeekGameTieMetrics({
      teamIds: [team!.id],
      seasonYear: season.seasonYear,
      week: 1,
      scoringPreset: season.scoringPreset,
      frozenLineups: frozen,
    });

    const teamMetrics = metrics.get(team!.id);
    assert.ok(teamMetrics);
    // full_ppr scores pass_yd via calculate (ptsPpr seed is not used here).
    // Frozen starter must beat the live-roster bench player (pass_yd: 50).
    assert.ok(teamMetrics.highestStarterPts > 5);
    assert.notEqual(teamMetrics.highestStarterPts, 2);
  });

  it("non-final week does not write snapshots", async () => {
    const { season } = await seedLeagueSeason(testDb, { teamCount: 2 });
    const [home, away] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });
    const [p1, p2] = await seedPlayers(testDb, [
      { fullName: "Live QB", primaryPositionId: "QB" },
      { fullName: "Live RB", primaryPositionId: "RB" },
    ]);

    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: home!.id,
      playerId: p1!.id,
      slotPositionId: "QB",
    });
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: away!.id,
      playerId: p2!.id,
      slotPositionId: "RB",
    });

    await seedPlayerScore(testDb, {
      playerId: p1!.id,
      season: String(season.seasonYear),
      week: 3,
      kind: "stats",
      stats: { pass_yd: 200 },
      ptsPpr: 8,
    });
    await seedPlayerScore(testDb, {
      playerId: p2!.id,
      season: String(season.seasonYear),
      week: 3,
      kind: "stats",
      stats: { rush_yd: 60 },
      ptsPpr: 6,
    });

    const matchup = await seedMatchup(testDb, {
      leagueSeasonId: season.id,
      week: 3,
      homeTeamId: home!.id,
      awayTeamId: away!.id,
    });

    // Same week as currentWeek → not past week, so resultFinal needs games final.
    // Empty scoreboard → in_progress (actuals present) without finalizing.
    await finalizeSeasonWeekMatchups({
      season: seasonFinalizeInput(season),
      week: 3,
      currentWeek: 3,
      scoreboardGames: [],
      allowOfficialCorrections: false,
    });

    const [row] = await testDb
      .select()
      .from(matchups)
      .where(eq(matchups.id, matchup.id));
    assert.notEqual(row?.status, "final");

    const homeSnapshot = await loadTeamWeekLineup({
      leagueSeasonId: season.id,
      teamId: home!.id,
      week: 3,
    });
    assert.equal(homeSnapshot, null);
  });

  it("legacy final week with no snapshot + corrections on → pts unchanged", async () => {
    const { season } = await seedLeagueSeason(testDb, { teamCount: 2 });
    const [home, away] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });
    const [p1, p2, p3] = await seedPlayers(testDb, [
      { fullName: "Legacy QB", primaryPositionId: "QB" },
      { fullName: "Legacy RB", primaryPositionId: "RB" },
      { fullName: "Intruder", primaryPositionId: "QB" },
    ]);

    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: home!.id,
      playerId: p1!.id,
      slotPositionId: "QB",
    });
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: away!.id,
      playerId: p2!.id,
      slotPositionId: "RB",
    });

    await seedPlayerScore(testDb, {
      playerId: p1!.id,
      season: String(season.seasonYear),
      week: 1,
      kind: "stats",
      stats: { pass_yd: 300 },
      ptsPpr: 12,
    });
    await seedPlayerScore(testDb, {
      playerId: p3!.id,
      season: String(season.seasonYear),
      week: 1,
      kind: "stats",
      stats: { pass_yd: 500 },
      ptsPpr: 20,
    });

    const matchup = await seedMatchup(testDb, {
      leagueSeasonId: season.id,
      week: 1,
      homeTeamId: home!.id,
      awayTeamId: away!.id,
      status: "final",
      homePts: 12,
      awayPts: 10,
    });

    // No snapshot written. Add a high scorer to live roster.
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: home!.id,
      playerId: p3!.id,
      slotPositionId: "QB",
    });

    await finalizeSeasonWeekMatchups({
      season: seasonFinalizeInput(season),
      week: 1,
      currentWeek: 2,
      scoreboardGames: [],
      allowOfficialCorrections: true,
    });

    const [after] = await testDb
      .select()
      .from(matchups)
      .where(eq(matchups.id, matchup.id));

    assert.equal(after!.homePts, 12);
    assert.equal(after!.awayPts, 10);
  });

  it("upsertTeamWeekLineup is idempotent", async () => {
    const { season } = await seedLeagueSeason(testDb, { teamCount: 1 });
    const [team] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 1,
    });
    const [p1] = await seedPlayers(testDb, [
      { fullName: "Idempotent QB", primaryPositionId: "QB" },
    ]);

    await upsertTeamWeekLineup({
      leagueSeasonId: season.id,
      teamId: team!.id,
      week: 1,
      starters: [{ playerId: p1!.id, slotPositionId: "QB" }],
    });
    await upsertTeamWeekLineup({
      leagueSeasonId: season.id,
      teamId: team!.id,
      week: 1,
      starters: [{ playerId: p1!.id, slotPositionId: "RB" }],
    });

    const rows = await loadTeamWeekLineup({
      leagueSeasonId: season.id,
      teamId: team!.id,
      week: 1,
    });
    assert.equal(rows?.length, 1);
    assert.equal(rows![0]!.slotPositionId, "QB");
  });
});
