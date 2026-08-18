import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import { draftPicks, teams } from "@/db/schema";
import { backfillForcedAutopickFromDraftPicks } from "@/lib/leagues/draft/backfill-forced-autopick";
import { DEFAULT_DRAFT_SETTINGS } from "@/lib/leagues/draft-settings";
import { createTestDb, type TestDb } from "@/lib/test/harness";
import {
  seedDraft,
  seedLeagueSeason,
  seedPlayers,
  seedPositions,
  seedTeams,
} from "@/lib/test/seed";

describe("backfillForcedAutopickFromDraftPicks", () => {
  let testDb: TestDb;

  before(async () => {
    testDb = await createTestDb();
    await seedPositions(testDb);
  });

  it("forces Autopick when a team already has two trailing autopicks", async () => {
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
      { fullName: "Pick Four", primaryPositionId: "TE" },
    ]);
    const draft = await seedDraft(testDb, {
      leagueSeasonId: season.id,
      currentPickIndex: 4,
    });

    await testDb.insert(draftPicks).values([
      {
        draftId: draft.id,
        overall: 1,
        round: 1,
        pickInRound: 1,
        teamId: seasonTeams[0]!.id,
        playerId: drafted[0]!.id,
        source: "manual",
      },
      {
        draftId: draft.id,
        overall: 2,
        round: 1,
        pickInRound: 2,
        teamId: seasonTeams[1]!.id,
        playerId: drafted[1]!.id,
        source: "manual",
      },
      {
        draftId: draft.id,
        overall: 3,
        round: 2,
        pickInRound: 1,
        teamId: seasonTeams[1]!.id,
        playerId: drafted[2]!.id,
        source: "autopick",
      },
      {
        draftId: draft.id,
        overall: 4,
        round: 2,
        pickInRound: 2,
        teamId: seasonTeams[1]!.id,
        playerId: drafted[3]!.id,
        source: "autopick",
      },
    ]);

    const result = await backfillForcedAutopickFromDraftPicks({
      leagueSeasonId: season.id,
      draftId: draft.id,
    });

    assert.equal(result.forcedTeamIds.includes(seasonTeams[1]!.id), true);
    assert.equal(result.forcedTeamIds.includes(seasonTeams[0]!.id), false);

    const [teamTwo] = await testDb
      .select()
      .from(teams)
      .where(eq(teams.id, seasonTeams[1]!.id));
    assert.equal(teamTwo?.forcedAutoPick, true);
    assert.equal(teamTwo?.autoPickEnabled, true);
    assert.equal(teamTwo?.consecutiveExpiredPicks, 2);
  });
});
