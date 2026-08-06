import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DraftGradeTeamResult } from "@/lib/leagues/draft/grades";
import {
  buildDraftPowerRankingRows,
  buildEmptyDraftPowerRankingRows,
} from "@/lib/leagues/power-rankings/draft";
import type { LeagueStandingsMember } from "@/lib/leagues/standings";

function team(
  partial: Partial<LeagueStandingsMember> & {
    teamId: string;
    teamName: string;
  },
): LeagueStandingsMember {
  return {
    teamPublicId: partial.teamPublicId ?? partial.teamId,
    userId: partial.userId ?? null,
    displayName: partial.displayName ?? null,
    firstName: partial.firstName ?? null,
    lastName: partial.lastName ?? null,
    username: partial.username ?? null,
    draftSlot: partial.draftSlot ?? null,
    teamCreatedAt: partial.teamCreatedAt ?? null,
    waiverPriority: partial.waiverPriority ?? null,
    faabRemaining: partial.faabRemaining ?? null,
    logoUrl: partial.logoUrl ?? null,
    divisionId: partial.divisionId ?? null,
    ...partial,
  };
}

function grade(
  partial: Pick<DraftGradeTeamResult, "teamId" | "score" | "leagueRank">,
): DraftGradeTeamResult {
  return {
    letter: "B",
    teamCount: 3,
    projectedWins: 8,
    projectedLosses: 6,
    playoffOdds: 50,
    championshipOdds: 10,
    bestValue: null,
    worstValue: null,
    headline: "Solid foundation",
    ...partial,
  };
}

describe("buildDraftPowerRankingRows", () => {
  const teams = [
    team({ teamId: "a", teamName: "Alpha", firstName: "Ann" }),
    team({ teamId: "b", teamName: "Beta", firstName: "Bob" }),
    team({ teamId: "c", teamName: "Charlie", firstName: "Cat" }),
  ];

  it("ranks by draft-grade score with leader at 100", () => {
    const rows = buildDraftPowerRankingRows({
      teams,
      grades: [
        grade({ teamId: "b", score: 90, leagueRank: 1 }),
        grade({ teamId: "a", score: 60, leagueRank: 2 }),
        grade({ teamId: "c", score: 30, leagueRank: 3 }),
      ],
    });

    assert.deepEqual(
      rows.map((row) => ({
        teamId: row.teamId,
        rank: row.rank,
        powerScore: row.powerScore,
      })),
      [
        { teamId: "b", rank: 1, powerScore: 100 },
        { teamId: "a", rank: 2, powerScore: 67 },
        { teamId: "c", rank: 3, powerScore: 33 },
      ],
    );
  });

  it("returns zeros when no picks have been made", () => {
    const rows = buildEmptyDraftPowerRankingRows(teams);
    assert.equal(rows.length, 3);
    assert.ok(rows.every((row) => row.powerScore === 0));
    assert.deepEqual(
      rows.map((row) => row.rank),
      [1, 2, 3],
    );
  });
});
