import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decideNextPlayoffRound } from "@/lib/leagues/playoffs/decide-next-round";
import { emptyTeamGameTieMetrics } from "@/lib/leagues/tiebreakers/game-compare";

describe("decideNextPlayoffRound", () => {
  const seedByTeamId = new Map([
    ["a", 1],
    ["b", 4],
    ["c", 2],
    ["d", 3],
  ]);

  it("skips when the next week already exists", () => {
    const result = decideNextPlayoffRound({
      weekRows: [
        {
          homeTeamId: "a",
          awayTeamId: "b",
          homePts: 100,
          awayPts: 90,
          status: "final",
        },
      ],
      nextWeekAlreadyExists: true,
      isChampionshipRematchAdvance: false,
      seedByTeamId,
      gameTiebreakers: [],
      metricsByTeam: new Map(),
      nextWeek: 15,
      byeTeamIds: [],
      reSeedAfterEachRound: false,
    });
    assert.equal(result.action, "skip");
  });

  it("inserts next-round pairings from final winners", () => {
    const metricsByTeam = new Map([
      ["a", emptyTeamGameTieMetrics()],
      ["b", emptyTeamGameTieMetrics()],
      ["c", emptyTeamGameTieMetrics()],
      ["d", emptyTeamGameTieMetrics()],
    ]);
    const result = decideNextPlayoffRound({
      weekRows: [
        {
          homeTeamId: "a",
          awayTeamId: "b",
          homePts: 110,
          awayPts: 90,
          status: "final",
        },
        {
          homeTeamId: "c",
          awayTeamId: "d",
          homePts: 95,
          awayPts: 88,
          status: "final",
        },
      ],
      nextWeekAlreadyExists: false,
      isChampionshipRematchAdvance: false,
      seedByTeamId,
      gameTiebreakers: [],
      metricsByTeam,
      nextWeek: 16,
      byeTeamIds: [],
      reSeedAfterEachRound: false,
    });
    assert.equal(result.action, "insert");
    if (result.action !== "insert") return;
    assert.equal(result.pairings.length, 1);
    assert.equal(result.pairings[0]?.week, 16);
    assert.deepEqual(
      [result.pairings[0]?.homeTeamId, result.pairings[0]?.awayTeamId].sort(),
      ["a", "c"].sort(),
    );
  });
});
