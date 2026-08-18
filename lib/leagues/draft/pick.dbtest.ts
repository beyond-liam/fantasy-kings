import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import { drafts, leagueSeasons, rosterPlayers, teams } from "@/db/schema";
import { commitDraftPick } from "@/lib/leagues/draft/pick";
import { DEFAULT_DRAFT_SETTINGS } from "@/lib/leagues/draft-settings";
import { createTestDb, type TestDb } from "@/lib/test/harness";
import {
  seedDraft,
  seedLeagueSeason,
  seedPlayers,
  seedPositions,
  seedRosterPlayer,
  seedTeams,
} from "@/lib/test/seed";

describe("commitDraftPick", () => {
  let testDb: TestDb;

  before(async () => {
    testDb = await createTestDb();
    await seedPositions(testDb);
  });

  it("commits the pick, rosters the player, and advances the clock", async () => {
    const { season } = await seedLeagueSeason(testDb, { teamCount: 2 });
    const seasonTeams = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });
    const [player] = await seedPlayers(testDb, [
      { fullName: "Josh Allen", primaryPositionId: "QB" },
    ]);
    const draft = await seedDraft(testDb, { leagueSeasonId: season.id });

    const result = await commitDraftPick({
      leagueSeasonId: season.id,
      draftId: draft.id,
      currentPickIndex: 0,
      pickTimeLimitSeconds: season.pickTimeLimitSeconds,
      settings: season.settings,
      benchSlots: season.benchSlots,
      irEnabled: season.irEnabled,
      taxiEnabled: season.taxiEnabled,
      seasonTeams,
      playerId: player!.id,
      madeByUserId: seasonTeams[0]!.userId,
      source: "manual",
      actingTeamId: seasonTeams[0]!.id,
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.nextPickIndex, 1);
    assert.equal(result.ok && result.isComplete, false);

    const [rosterRow] = await testDb
      .select()
      .from(rosterPlayers)
      .where(eq(rosterPlayers.playerId, player!.id));
    assert.equal(rosterRow?.teamId, seasonTeams[0]!.id);
    assert.equal(rosterRow?.status, "rostered");

    const [draftRow] = await testDb
      .select()
      .from(drafts)
      .where(eq(drafts.id, draft.id));
    assert.equal(draftRow?.currentPickIndex, 1);
    assert.notEqual(draftRow?.turnExpiresAt, null);
  });

  it("rejects a manual pick when it is not the acting team's turn", async () => {
    const { season } = await seedLeagueSeason(testDb, { teamCount: 2 });
    const seasonTeams = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });
    const [player] = await seedPlayers(testDb, [
      { fullName: "Christian McCaffrey", primaryPositionId: "RB" },
    ]);
    const draft = await seedDraft(testDb, { leagueSeasonId: season.id });

    const result = await commitDraftPick({
      leagueSeasonId: season.id,
      draftId: draft.id,
      currentPickIndex: 0,
      pickTimeLimitSeconds: season.pickTimeLimitSeconds,
      settings: season.settings,
      benchSlots: season.benchSlots,
      irEnabled: season.irEnabled,
      taxiEnabled: season.taxiEnabled,
      seasonTeams,
      playerId: player!.id,
      madeByUserId: seasonTeams[1]!.userId,
      source: "manual",
      actingTeamId: seasonTeams[1]!.id,
    });

    assert.deepEqual(result, {
      ok: false,
      error: "It is not your turn to pick.",
    });
  });

  it("rejects a pick on a player already drafted in this draft", async () => {
    const { season } = await seedLeagueSeason(testDb, { teamCount: 2 });
    const seasonTeams = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });
    const [player] = await seedPlayers(testDb, [
      { fullName: "Tyreek Hill", primaryPositionId: "WR" },
    ]);
    const draft = await seedDraft(testDb, { leagueSeasonId: season.id });

    const commonInput = {
      leagueSeasonId: season.id,
      draftId: draft.id,
      pickTimeLimitSeconds: season.pickTimeLimitSeconds,
      settings: season.settings,
      benchSlots: season.benchSlots,
      irEnabled: season.irEnabled,
      taxiEnabled: season.taxiEnabled,
      seasonTeams,
      playerId: player!.id,
      source: "manual" as const,
    };

    const first = await commitDraftPick({
      ...commonInput,
      currentPickIndex: 0,
      madeByUserId: seasonTeams[0]!.userId,
      actingTeamId: seasonTeams[0]!.id,
    });
    assert.equal(first.ok, true);

    const second = await commitDraftPick({
      ...commonInput,
      currentPickIndex: 1,
      madeByUserId: seasonTeams[1]!.userId,
      actingTeamId: seasonTeams[1]!.id,
    });
    assert.deepEqual(second, {
      ok: false,
      error: "Player has already been drafted.",
    });
  });

  it("rejects a pick when the acting team's roster is already full", async () => {
    const { season } = await seedLeagueSeason(testDb, {
      teamCount: 2,
      benchSlots: 0,
      rosterSlots: [
        { positionId: "QB", slotCount: 1, minSlots: 1, maxSlots: 1, isStarter: true },
      ],
    });
    const seasonTeams = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });
    const [existingQb, incomingQb] = await seedPlayers(testDb, [
      { fullName: "Existing Starter QB", primaryPositionId: "QB" },
      { fullName: "Incoming QB", primaryPositionId: "QB" },
    ]);
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: seasonTeams[0]!.id,
      playerId: existingQb!.id,
    });
    const draft = await seedDraft(testDb, { leagueSeasonId: season.id });

    const result = await commitDraftPick({
      leagueSeasonId: season.id,
      draftId: draft.id,
      currentPickIndex: 0,
      pickTimeLimitSeconds: season.pickTimeLimitSeconds,
      settings: season.settings,
      benchSlots: season.benchSlots,
      irEnabled: season.irEnabled,
      taxiEnabled: season.taxiEnabled,
      seasonTeams,
      playerId: incomingQb!.id,
      madeByUserId: seasonTeams[0]!.userId,
      source: "manual",
      actingTeamId: seasonTeams[0]!.id,
    });

    assert.deepEqual(result, {
      ok: false,
      error: "This team's roster is full.",
    });
  });

  it("completes the draft and activates the season on the final pick", async () => {
    const { season } = await seedLeagueSeason(testDb, {
      status: "draft",
      teamCount: 1,
      benchSlots: 0,
      rosterSlots: [
        { positionId: "QB", slotCount: 1, minSlots: 1, maxSlots: 1, isStarter: true },
      ],
    });
    const seasonTeams = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 1,
    });
    const [player] = await seedPlayers(testDb, [
      { fullName: "Last Pick QB", primaryPositionId: "QB" },
    ]);
    const draft = await seedDraft(testDb, { leagueSeasonId: season.id });

    const result = await commitDraftPick({
      leagueSeasonId: season.id,
      draftId: draft.id,
      currentPickIndex: 0,
      pickTimeLimitSeconds: season.pickTimeLimitSeconds,
      settings: season.settings,
      benchSlots: season.benchSlots,
      irEnabled: season.irEnabled,
      taxiEnabled: season.taxiEnabled,
      seasonTeams,
      playerId: player!.id,
      madeByUserId: seasonTeams[0]!.userId,
      source: "manual",
      actingTeamId: seasonTeams[0]!.id,
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.isComplete, true);

    const [draftRow] = await testDb
      .select()
      .from(drafts)
      .where(eq(drafts.id, draft.id));
    assert.equal(draftRow?.status, "complete");
    assert.notEqual(draftRow?.completedAt, null);
    assert.equal(draftRow?.turnExpiresAt, null);

    const [seasonRow] = await testDb
      .select()
      .from(leagueSeasons)
      .where(eq(leagueSeasons.id, season.id));
    assert.equal(seasonRow?.status, "active");
  });

  it("forces Autopick after two consecutive missed clocks", async () => {
    const { season } = await seedLeagueSeason(testDb, {
      teamCount: 2,
      settings: {
        draft: {
          ...DEFAULT_DRAFT_SETTINGS,
          forceAutopickAfterTwoExpires: true,
        },
      },
    });
    const seasonTeams = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });
    const drafted = await seedPlayers(testDb, [
      { fullName: "Pick One", primaryPositionId: "QB" },
      { fullName: "Pick Two", primaryPositionId: "RB" },
      { fullName: "Pick Three", primaryPositionId: "WR" },
    ]);
    const draft = await seedDraft(testDb, { leagueSeasonId: season.id });
    const base = {
      leagueSeasonId: season.id,
      draftId: draft.id,
      pickTimeLimitSeconds: season.pickTimeLimitSeconds,
      settings: season.settings,
      benchSlots: season.benchSlots,
      irEnabled: season.irEnabled,
      taxiEnabled: season.taxiEnabled,
      seasonTeams,
    };

    const first = await commitDraftPick({
      ...base,
      currentPickIndex: 0,
      playerId: drafted[0]!.id,
      madeByUserId: seasonTeams[0]!.userId,
      source: "manual",
      actingTeamId: seasonTeams[0]!.id,
    });
    assert.equal(first.ok, true);

    const missOne = await commitDraftPick({
      ...base,
      currentPickIndex: 1,
      playerId: drafted[1]!.id,
      madeByUserId: null,
      source: "autopick",
      missedClock: true,
    });
    assert.equal(missOne.ok, true);

    const missTwo = await commitDraftPick({
      ...base,
      currentPickIndex: 2,
      playerId: drafted[2]!.id,
      madeByUserId: null,
      source: "autopick",
      missedClock: true,
    });
    assert.equal(missTwo.ok, true);

    const [teamTwo] = await testDb
      .select()
      .from(teams)
      .where(eq(teams.id, seasonTeams[1]!.id));
    assert.equal(teamTwo?.consecutiveExpiredPicks, 2);
    assert.equal(teamTwo?.forcedAutoPick, true);
    assert.equal(teamTwo?.autoPickEnabled, true);
  });
});
