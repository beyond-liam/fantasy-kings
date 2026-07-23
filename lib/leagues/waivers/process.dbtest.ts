import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import { leagueSeasons, rosterPlayers, teams, waiverClaims } from "@/db/schema";
import { processSeasonWaivers } from "@/lib/leagues/waivers/process";
import { createTestDb, type TestDb } from "@/lib/test/harness";
import {
  seedLeagueSeason,
  seedPlayers,
  seedPositions,
  seedRosterPlayer,
  seedTeams,
} from "@/lib/test/seed";

// Wednesday process runs at 10:00 UTC; claims must land at/before the 09:00 deadline.
const NOW = new Date(Date.UTC(2026, 6, 15, 11, 0, 0));
const ELIGIBLE_CLAIM_CREATED_AT = new Date(Date.UTC(2026, 6, 15, 8, 0, 0));

describe("processSeasonWaivers", () => {
  let testDb: TestDb;

  before(async () => {
    testDb = await createTestDb();
    await seedPositions(testDb);
  });

  it("awards the claim with the highest FAAB bid and deducts the winner's budget", async () => {
    const { season } = await seedLeagueSeason(testDb, {
      teamCount: 2,
      waiverType: "faab",
      faabBudget: 100,
    });
    const seasonTeams = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });
    const [freeAgent] = await seedPlayers(testDb, [
      { fullName: "Free Agent WR", primaryPositionId: "WR" },
    ]);

    await testDb.insert(waiverClaims).values([
      {
        leagueSeasonId: season.id,
        teamId: seasonTeams[0]!.id,
        playerId: freeAgent!.id,
        dropPlayerId: null,
        bid: 12,
        createdAt: ELIGIBLE_CLAIM_CREATED_AT,
      },
      {
        leagueSeasonId: season.id,
        teamId: seasonTeams[1]!.id,
        playerId: freeAgent!.id,
        dropPlayerId: null,
        bid: 30,
        createdAt: ELIGIBLE_CLAIM_CREATED_AT,
      },
    ]);

    const result = await processSeasonWaivers({
      season,
      leagueSlug: "test-league",
      now: NOW,
    });

    assert.deepEqual(result, { awarded: 1, failed: 1 });

    const claimRows = await testDb
      .select()
      .from(waiverClaims)
      .where(eq(waiverClaims.leagueSeasonId, season.id));
    const winnerClaim = claimRows.find((row) => row.teamId === seasonTeams[1]!.id);
    const loserClaim = claimRows.find((row) => row.teamId === seasonTeams[0]!.id);
    assert.equal(winnerClaim?.status, "awarded");
    assert.equal(loserClaim?.status, "failed");
    assert.equal(loserClaim?.failReason, "Outbid.");

    const [rosterRow] = await testDb
      .select()
      .from(rosterPlayers)
      .where(eq(rosterPlayers.playerId, freeAgent!.id));
    assert.equal(rosterRow?.teamId, seasonTeams[1]!.id);

    const [winnerTeam] = await testDb
      .select()
      .from(teams)
      .where(eq(teams.id, seasonTeams[1]!.id));
    const [loserTeam] = await testDb
      .select()
      .from(teams)
      .where(eq(teams.id, seasonTeams[0]!.id));
    assert.equal(winnerTeam?.faabRemaining, 70);
    assert.equal(loserTeam?.faabRemaining, 100);
  });

  it("waives the requested drop and rosters the claimed player", async () => {
    const { season } = await seedLeagueSeason(testDb, { teamCount: 1 });
    const seasonTeams = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 1,
    });
    const [existingRb, newWr] = await seedPlayers(testDb, [
      { fullName: "Existing RB", primaryPositionId: "RB" },
      { fullName: "New WR", primaryPositionId: "WR" },
    ]);
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: seasonTeams[0]!.id,
      playerId: existingRb!.id,
    });

    await testDb.insert(waiverClaims).values({
      leagueSeasonId: season.id,
      teamId: seasonTeams[0]!.id,
      playerId: newWr!.id,
      dropPlayerId: existingRb!.id,
      bid: null,
      createdAt: ELIGIBLE_CLAIM_CREATED_AT,
    });

    const result = await processSeasonWaivers({
      season,
      leagueSlug: "test-league",
      now: NOW,
    });
    assert.deepEqual(result, { awarded: 1, failed: 0 });

    const [droppedRow] = await testDb
      .select()
      .from(rosterPlayers)
      .where(eq(rosterPlayers.playerId, existingRb!.id));
    assert.equal(droppedRow?.status, "waived");
    assert.notEqual(droppedRow?.waiverClearsAt, null);

    const [awardedRow] = await testDb
      .select()
      .from(rosterPlayers)
      .where(eq(rosterPlayers.playerId, newWr!.id));
    assert.equal(awardedRow?.status, "rostered");
    assert.equal(awardedRow?.teamId, seasonTeams[0]!.id);
  });

  it("stamps lastWaiverProcessedAt even when there are no pending claims", async () => {
    const { season } = await seedLeagueSeason(testDb, { teamCount: 1 });
    await seedTeams(testDb, { leagueSeasonId: season.id, count: 1 });

    const result = await processSeasonWaivers({
      season,
      leagueSlug: "test-league",
      now: NOW,
    });
    assert.deepEqual(result, { awarded: 0, failed: 0 });

    const [seasonRow] = await testDb
      .select()
      .from(leagueSeasons)
      .where(eq(leagueSeasons.id, season.id));
    assert.equal(seasonRow?.lastWaiverProcessedAt?.getTime(), NOW.getTime());
  });

  it("leaves the roster untouched when a failed claim's position-max check trips after the would-be drop", async () => {
    const { season } = await seedLeagueSeason(testDb, {
      teamCount: 1,
      benchSlots: 1,
      rosterSlots: [
        { positionId: "QB", slotCount: 1, minSlots: 1, maxSlots: 1, isStarter: true },
        { positionId: "RB", slotCount: 1, minSlots: 1, maxSlots: 1, isStarter: true },
      ],
    });
    const seasonTeams = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 1,
    });
    const [otherQb, rbToDrop, incomingQb] = await seedPlayers(testDb, [
      { fullName: "Other Starter QB", primaryPositionId: "QB" },
      { fullName: "RB To Drop", primaryPositionId: "RB" },
      { fullName: "Incoming QB", primaryPositionId: "QB" },
    ]);
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: seasonTeams[0]!.id,
      playerId: otherQb!.id,
      slotPositionId: "QB",
    });
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: seasonTeams[0]!.id,
      playerId: rbToDrop!.id,
      slotPositionId: "RB",
    });

    await testDb.insert(waiverClaims).values({
      leagueSeasonId: season.id,
      teamId: seasonTeams[0]!.id,
      playerId: incomingQb!.id,
      dropPlayerId: rbToDrop!.id,
      bid: null,
      createdAt: ELIGIBLE_CLAIM_CREATED_AT,
    });

    const result = await processSeasonWaivers({
      season,
      leagueSlug: "test-league",
      now: NOW,
    });
    assert.deepEqual(result, { awarded: 0, failed: 1 });

    const [claimRow] = await testDb
      .select()
      .from(waiverClaims)
      .where(eq(waiverClaims.playerId, incomingQb!.id));
    assert.equal(claimRow?.status, "failed");
    assert.equal(claimRow?.failReason, "At max QBs — choose a different drop.");

    // applyAwardedClaim() now validates roster/position caps before writing anything,
    // and commits the drop + add in one transaction — a failed claim must not touch
    // the roster at all.
    const [droppedRow] = await testDb
      .select()
      .from(rosterPlayers)
      .where(eq(rosterPlayers.playerId, rbToDrop!.id));
    assert.equal(droppedRow?.status, "rostered");

    const [incomingRow] = await testDb
      .select()
      .from(rosterPlayers)
      .where(eq(rosterPlayers.playerId, incomingQb!.id));
    assert.equal(incomingRow, undefined);
  });

  it("leaves the requested drop untouched when the claimed player is rostered elsewhere before processing", async () => {
    const { season } = await seedLeagueSeason(testDb, { teamCount: 2 });
    const seasonTeams = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });
    const [rbToDrop, contestedWr] = await seedPlayers(testDb, [
      { fullName: "Race RB To Drop", primaryPositionId: "RB" },
      { fullName: "Race Contested WR", primaryPositionId: "WR" },
    ]);
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: seasonTeams[0]!.id,
      playerId: rbToDrop!.id,
    });
    // Simulates another manager rostering the same free agent between claim
    // creation and processing (e.g. a direct add on a non-waiver pool).
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: seasonTeams[1]!.id,
      playerId: contestedWr!.id,
    });

    await testDb.insert(waiverClaims).values({
      leagueSeasonId: season.id,
      teamId: seasonTeams[0]!.id,
      playerId: contestedWr!.id,
      dropPlayerId: rbToDrop!.id,
      bid: null,
      createdAt: ELIGIBLE_CLAIM_CREATED_AT,
    });

    const result = await processSeasonWaivers({
      season,
      leagueSlug: "test-league",
      now: NOW,
    });
    assert.deepEqual(result, { awarded: 0, failed: 1 });

    const [claimRow] = await testDb
      .select()
      .from(waiverClaims)
      .where(eq(waiverClaims.playerId, contestedWr!.id));
    assert.equal(claimRow?.status, "failed");
    assert.equal(
      claimRow?.failReason,
      "Player was already claimed or rostered by another team.",
    );

    const [droppedRow] = await testDb
      .select()
      .from(rosterPlayers)
      .where(eq(rosterPlayers.playerId, rbToDrop!.id));
    assert.equal(droppedRow?.status, "rostered");
    assert.equal(droppedRow?.teamId, seasonTeams[0]!.id);
  });
});
