import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPlayoffStandingsRows,
  resolvePlayoffCutoffSeed,
} from "@/lib/leagues/playoff-standings";
import type { LeagueStandingsRow } from "@/lib/leagues/standings";

function stubRow(id: string): LeagueStandingsRow {
  return {
    id,
    teamId: id,
    teamPublicId: id,
    claimed: true,
    teamName: id,
    ownerName: "Owner",
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
    waiverPriority: 1,
    faabRemaining: null,
    rank: 1,
    draftOrder: 1,
    opponentName: null,
  };
}

describe("resolvePlayoffCutoffSeed", () => {
  it("returns null when playoffs are disabled", () => {
    assert.equal(
      resolvePlayoffCutoffSeed({
        enabled: false,
        playoffTeamCount: 6,
        teamCount: 12,
      }),
      null,
    );
  });

  it("clamps to league size", () => {
    assert.equal(
      resolvePlayoffCutoffSeed({
        enabled: true,
        playoffTeamCount: 6,
        teamCount: 12,
      }),
      6,
    );
    assert.equal(
      resolvePlayoffCutoffSeed({
        enabled: true,
        playoffTeamCount: 8,
        teamCount: 6,
      }),
      6,
    );
  });
});

describe("buildPlayoffStandingsRows", () => {
  it("assigns 1-based seeds in standings order", () => {
    const rows = buildPlayoffStandingsRows([
      stubRow("a"),
      stubRow("b"),
      stubRow("c"),
    ]);
    assert.deepEqual(
      rows.map((row) => row.seed),
      [1, 2, 3],
    );
  });
});
