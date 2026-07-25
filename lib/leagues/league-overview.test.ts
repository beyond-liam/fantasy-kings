import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSeasonPositionLeaders,
  rankByInefficiency,
  rankByPointsAgainst,
  rankByPointsFor,
  sliceStandingsAroundFocus,
} from "@/lib/leagues/league-overview";
import type { LeagueStandingsRow } from "@/lib/leagues/standings";

function row(
  overrides: Partial<LeagueStandingsRow> & { id: string; teamName: string },
): LeagueStandingsRow {
  return {
    teamId: overrides.id,
    teamPublicId: overrides.id,
    claimed: true,
    ownerName: "Mgr",
    logoUrl: null,
    wins: 0,
    losses: 0,
    ties: 0,
    winPct: 0,
    gamesBehind: null,
    streak: null,
    pointsFor: 0,
    pointsForAvg: 0,
    pointsAgainst: 0,
    pointsAgainstAvg: 0,
    waiverPriority: null,
    faabRemaining: null,
    rank: null,
    draftOrder: null,
    opponentName: null,
    form: [],
    sos: null,
    sosPlayed: null,
    sosRemaining: null,
    ...overrides,
  };
}

describe("sliceStandingsAroundFocus", () => {
  const rows = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  it("returns mid window around focus", () => {
    assert.deepEqual(sliceStandingsAroundFocus(rows, 4), [2, 3, 4, 5, 6]);
  });

  it("pads below when focus is at the top", () => {
    assert.deepEqual(sliceStandingsAroundFocus(rows, 0), [0, 1, 2, 3, 4]);
  });

  it("pads above when focus is at the bottom", () => {
    assert.deepEqual(sliceStandingsAroundFocus(rows, 9), [5, 6, 7, 8, 9]);
  });

  it("returns all rows when the league is small", () => {
    assert.deepEqual(sliceStandingsAroundFocus([0, 1, 2], 1), [0, 1, 2]);
  });
});

describe("overview rankings", () => {
  it("ranks PF / PA / inefficiency", () => {
    const standings = [
      row({ id: "a", teamName: "A", pointsFor: 100, pointsAgainst: 80 }),
      row({ id: "b", teamName: "B", pointsFor: 120, pointsAgainst: 130 }),
      row({ id: "c", teamName: "C", pointsFor: 90, pointsAgainst: 70 }),
    ];
    assert.equal(rankByPointsFor(standings, 2)[0]?.teamId, "b");
    assert.equal(rankByPointsAgainst(standings, 2)[0]?.teamId, "b");

    const ineff = rankByInefficiency(
      [
        {
          teamId: "a",
          teamPublicId: "a",
          teamName: "A",
          ownerName: "Alex",
          logoUrl: null,
          claimed: true,
          seasonPointsFor: 100,
          seasonOptimumPointsFor: 140,
        },
        {
          teamId: "b",
          teamPublicId: "b",
          teamName: "B",
          ownerName: "Bea",
          logoUrl: null,
          claimed: true,
          seasonPointsFor: 110,
          seasonOptimumPointsFor: 115,
        },
      ],
      5,
    );
    assert.equal(ineff[0]?.teamId, "a");
    assert.equal(ineff[0]?.value, 71.4);
  });

  it("picks season position leaders", () => {
    const leaders = buildSeasonPositionLeaders([
      {
        teamId: "a",
        teamPublicId: "a",
        teamName: "A",
        logoUrl: null,
        claimed: true,
        byPosition: { QB: 200, RB: 100 },
      },
      {
        teamId: "b",
        teamPublicId: "b",
        teamName: "B",
        logoUrl: null,
        claimed: true,
        byPosition: { QB: 180, RB: 150, WR: 120 },
      },
    ]);
    assert.equal(leaders.find((l) => l.positionId === "QB")?.teamId, "a");
    assert.equal(leaders.find((l) => l.positionId === "RB")?.teamId, "b");
    assert.equal(leaders.find((l) => l.positionId === "WR")?.teamId, "b");
  });
});
