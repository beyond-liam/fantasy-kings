import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  matchupHomeWinProbability,
  simulatePlayoffOdds,
} from "@/lib/leagues/playoff-odds";
import { resolvePlayoffPictureStatus } from "@/lib/leagues/playoff-picture";
import type { LeagueStandingsRow } from "@/lib/leagues/standings";

function stubRow(
  id: string,
  wins: number,
  losses: number,
  pfAvg = 100,
): LeagueStandingsRow {
  const games = wins + losses;
  return {
    id,
    teamId: id,
    teamPublicId: id,
    claimed: true,
    teamName: id,
    ownerName: "Owner",
    logoUrl: null,
    wins,
    losses,
    ties: 0,
    winPct: games === 0 ? 0 : wins / games,
    gamesBehind: null,
    streak: null,
    pointsFor: pfAvg * games,
    pointsForAvg: pfAvg,
    pointsAgainst: 0,
    pointsAgainstAvg: 0,
    waiverPriority: 1,
    faabRemaining: null,
    rank: 1,
    draftOrder: 1,
    opponentName: null,
    form: [],
    sos: null,
    sosPlayed: null,
    sosRemaining: null,
  };
}

describe("matchupHomeWinProbability", () => {
  it("favors the higher PF/G team", () => {
    const p = matchupHomeWinProbability(120, 100);
    assert.ok(p > 0.5);
  });

  it("is even when both are zero", () => {
    assert.equal(matchupHomeWinProbability(0, 0), 0.5);
  });
});

describe("resolvePlayoffPictureStatus", () => {
  it("marks eliminated when enough teams are locked above", () => {
    const rows = [
      stubRow("a", 10, 0),
      stubRow("b", 9, 1),
      stubRow("c", 0, 10),
    ];
    const remaining = new Map([
      ["a", 0],
      ["b", 0],
      ["c", 0],
    ]);
    assert.equal(
      resolvePlayoffPictureStatus({
        teamId: "c",
        rows,
        remainingGamesByTeamId: remaining,
        playoffSpots: 2,
      }),
      "eliminated",
    );
  });

  it("marks clinched when enough teams are locked below", () => {
    const rows = [
      stubRow("a", 10, 0),
      stubRow("b", 0, 10),
      stubRow("c", 0, 10),
    ];
    const remaining = new Map([
      ["a", 0],
      ["b", 0],
      ["c", 0],
    ]);
    assert.equal(
      resolvePlayoffPictureStatus({
        teamId: "a",
        rows,
        remainingGamesByTeamId: remaining,
        playoffSpots: 1,
      }),
      "clinched",
    );
  });
});

describe("simulatePlayoffOdds", () => {
  it("gives higher odds to the stronger team", () => {
    const rows = [stubRow("a", 5, 2, 120), stubRow("b", 2, 5, 90)];
    const odds = simulatePlayoffOdds({
      rows,
      remainingMatchups: [{ homeTeamId: "a", awayTeamId: "b" }],
      playoffSpots: 1,
      simulations: 800,
      seed: 7,
    });
    assert.ok((odds.get("a") ?? 0) > (odds.get("b") ?? 0));
  });

  it("respects clinched override", () => {
    const rows = [stubRow("a", 5, 2), stubRow("b", 2, 5)];
    const odds = simulatePlayoffOdds({
      rows,
      remainingMatchups: [{ homeTeamId: "a", awayTeamId: "b" }],
      playoffSpots: 1,
      pictureByTeamId: new Map([
        ["a", "clinched"],
        ["b", "eliminated"],
      ]),
    });
    assert.equal(odds.get("a"), 1);
    assert.equal(odds.get("b"), 0);
  });
});
