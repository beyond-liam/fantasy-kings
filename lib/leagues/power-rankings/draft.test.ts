import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DraftGradeTeamResult } from "@/lib/leagues/draft/grades";
import {
  buildDraftPowerRankingRows,
  buildEmptyDraftPowerRankingRows,
} from "@/lib/leagues/power-rankings/draft";
import { buildPowerRankingRowsFromStrength } from "@/lib/leagues/power-rankings/rows";
import { buildRosterPowerRankingRows } from "@/lib/leagues/power-rankings/roster";
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
  partial: Pick<
    DraftGradeTeamResult,
    "teamId" | "score" | "leagueRank" | "projectedStrength"
  >,
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

  it("ranks by absolute projected strength with leader at 100", () => {
    const rows = buildDraftPowerRankingRows({
      teams,
      grades: [
        grade({
          teamId: "b",
          score: 100,
          leagueRank: 1,
          projectedStrength: 1200,
        }),
        grade({
          teamId: "a",
          score: 50,
          leagueRank: 2,
          projectedStrength: 1140,
        }),
        grade({
          teamId: "c",
          score: 0,
          leagueRank: 3,
          projectedStrength: 1080,
        }),
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
        { teamId: "a", rank: 2, powerScore: 95 },
        { teamId: "c", rank: 3, powerScore: 90 },
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

describe("buildPowerRankingRowsFromStrength", () => {
  it("keeps close strengths clustered instead of forcing last to 0", () => {
    const teams = [
      team({ teamId: "a", teamName: "A" }),
      team({ teamId: "b", teamName: "B" }),
      team({ teamId: "c", teamName: "C" }),
      team({ teamId: "d", teamName: "D" }),
    ];
    const rows = buildPowerRankingRowsFromStrength({
      teams,
      strengthByTeamId: new Map([
        ["a", 1000],
        ["b", 980],
        ["c", 960],
        ["d", 940],
      ]),
    });

    assert.deepEqual(
      rows.map((row) => row.powerScore),
      [100, 98, 96, 94],
    );
  });
});

describe("buildRosterPowerRankingRows", () => {
  it("weights starters fully and benches at 0.35", () => {
    const teams = [
      team({ teamId: "strong", teamName: "Strong" }),
      team({ teamId: "weak", teamName: "Weak" }),
    ];
    const rows = buildRosterPowerRankingRows({
      teams,
      starterSlots: 1,
      fantasyPtsByPlayerId: new Map([
        ["s1", 100],
        ["s2", 100],
        ["w1", 50],
        ["w2", 50],
      ]),
      playerIdsByTeamId: new Map([
        ["strong", ["s1", "s2"]],
        ["weak", ["w1", "w2"]],
      ]),
    });

    // strong: 100 + 100*0.35 = 135 → 100
    // weak: 50 + 50*0.35 = 67.5 → round(100 * 67.5/135) = 50
    assert.deepEqual(
      rows.map((row) => ({ teamId: row.teamId, powerScore: row.powerScore })),
      [
        { teamId: "strong", powerScore: 100 },
        { teamId: "weak", powerScore: 50 },
      ],
    );
  });
});
