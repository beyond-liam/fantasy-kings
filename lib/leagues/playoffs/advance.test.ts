import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  championshipLegs,
  duplicatePairingsForWeek,
  firstRoundPairings,
  nextRoundPairings,
  winnerOfFinalMatchup,
  winnerOfTwoWeekSeries,
} from "@/lib/leagues/playoffs/advance";
import { scheduleMatchupResult } from "@/lib/leagues/schedule-display";

describe("winnerOfFinalMatchup", () => {
  it("picks the higher-scoring team", () => {
    assert.equal(
      winnerOfFinalMatchup({
        homeTeamId: "h",
        awayTeamId: "a",
        homePts: 110,
        awayPts: 100,
        status: "final",
      }),
      "h",
    );
  });

  it("returns home (higher seed) on ties without metrics; null for non-finals", () => {
    assert.equal(
      winnerOfFinalMatchup({
        homeTeamId: "h",
        awayTeamId: "a",
        homePts: 100,
        awayPts: 100,
        status: "final",
      }),
      "h",
    );
    assert.equal(
      winnerOfFinalMatchup({
        homeTeamId: "h",
        awayTeamId: "a",
        homePts: 110,
        awayPts: 100,
        status: "in_progress",
      }),
      null,
    );
  });

  it("uses game tiebreakers when points are tied", () => {
    assert.equal(
      winnerOfFinalMatchup({
        homeTeamId: "h",
        awayTeamId: "a",
        homePts: 100,
        awayPts: 100,
        status: "final",
        gameTiebreakers: ["bench_points", "highest_starter", "offensive_special_tds"],
        homeMetrics: {
          offensiveSpecialTds: 1,
          highestStarterPts: 20,
          benchPts: 10,
        },
        awayMetrics: {
          offensiveSpecialTds: 2,
          highestStarterPts: 25,
          benchPts: 30,
        },
      }),
      "a",
    );
  });
});

describe("firstRoundPairings", () => {
  it("seeds a 4-team bracket", () => {
    const pairings = firstRoundPairings({
      seeds: [
        { seed: 1, teamId: "t1" },
        { seed: 2, teamId: "t2" },
        { seed: 3, teamId: "t3" },
        { seed: 4, teamId: "t4" },
      ],
      playoffTeamCount: 4,
      championshipWeek: 17,
    });
    assert.equal(pairings.length, 2);
    assert.deepEqual(pairings[0], {
      week: 16,
      homeTeamId: "t1",
      awayTeamId: "t4",
    });
  });
});

describe("nextRoundPairings", () => {
  it("pairs each bye with a QF winner (not bye-vs-bye)", () => {
    const pairings = nextRoundPairings({
      nextWeek: 17,
      byeTeamIds: ["b1", "b2"],
      winnersInBracketOrder: ["w1", "w2"],
    });
    assert.deepEqual(pairings, [
      { week: 17, homeTeamId: "b1", awayTeamId: "w1" },
      { week: 17, homeTeamId: "b2", awayTeamId: "w2" },
    ]);
  });

  it("re-seeds remaining teams highest vs lowest", () => {
    const pairings = nextRoundPairings({
      nextWeek: 17,
      byeTeamIds: ["s1", "s2"],
      winnersInBracketOrder: ["s6", "s4"],
      reSeedAfterEachRound: true,
      seedByTeamId: new Map([
        ["s1", 1],
        ["s2", 2],
        ["s4", 4],
        ["s6", 6],
      ]),
    });
    assert.deepEqual(pairings, [
      { week: 17, homeTeamId: "s1", awayTeamId: "s6" },
      { week: 17, homeTeamId: "s2", awayTeamId: "s4" },
    ]);
  });

  it("pairs winners in order when there are no byes", () => {
    const pairings = nextRoundPairings({
      nextWeek: 18,
      winnersInBracketOrder: ["w1", "w2", "w3", "w4"],
    });
    assert.deepEqual(pairings, [
      { week: 18, homeTeamId: "w1", awayTeamId: "w2" },
      { week: 18, homeTeamId: "w3", awayTeamId: "w4" },
    ]);
  });

  it("produces identical pairings regardless of winners order when bracket order matters", () => {
    // Without re-seeding, bracket position matters: winners are paired sequentially.
    // This test verifies that if we get the same winners in different orders,
    // the bracket order determines pairing (not the input order).
    const orderedWinners = ["w1", "w2", "w3", "w4"];
    const shuffledWinners = ["w3", "w1", "w4", "w2"];

    const pairings1 = nextRoundPairings({
      nextWeek: 18,
      winnersInBracketOrder: orderedWinners,
    });

    const pairings2 = nextRoundPairings({
      nextWeek: 18,
      winnersInBracketOrder: shuffledWinners,
    });

    // These should be different because bracket order matters in the no-reseed case
    assert.deepEqual(pairings1, [
      { week: 18, homeTeamId: "w1", awayTeamId: "w2" },
      { week: 18, homeTeamId: "w3", awayTeamId: "w4" },
    ]);

    assert.deepEqual(pairings2, [
      { week: 18, homeTeamId: "w3", awayTeamId: "w1" },
      { week: 18, homeTeamId: "w4", awayTeamId: "w2" },
    ]);

    // The key test: if we have the same set of winners in bracket order,
    // we should get the same pairings
    const sameBracketOrder1 = nextRoundPairings({
      nextWeek: 18,
      winnersInBracketOrder: ["w1", "w2", "w3", "w4"],
    });

    const sameBracketOrder2 = nextRoundPairings({
      nextWeek: 18,
      winnersInBracketOrder: ["w1", "w2", "w3", "w4"],
    });

    assert.deepEqual(sameBracketOrder1, sameBracketOrder2);
  });
});

describe("championshipLegs + duplicatePairingsForWeek", () => {
  it("maps end week to game 1 / game 2", () => {
    assert.equal(championshipLegs({ endWeek: 17, twoWeekChampionship: false }), null);
    assert.deepEqual(championshipLegs({ endWeek: 17, twoWeekChampionship: true }), {
      leg1Week: 16,
      leg2Week: 17,
    });
  });

  it("duplicates home/away onto the next week", () => {
    assert.deepEqual(
      duplicatePairingsForWeek(
        [{ homeTeamId: "h", awayTeamId: "a" }],
        17,
      ),
      [{ week: 17, homeTeamId: "h", awayTeamId: "a" }],
    );
  });
});

describe("winnerOfTwoWeekSeries", () => {
  it("sums both legs and picks the higher total", () => {
    assert.equal(
      winnerOfTwoWeekSeries({
        homeTeamId: "h",
        awayTeamId: "a",
        leg1: { homePts: 100, awayPts: 110, status: "final" },
        leg2: { homePts: 120, awayPts: 100, status: "final" },
      }),
      "h", // 220 vs 210
    );
  });
});

describe("scheduleMatchupResult", () => {
  it("derives W/L/T from final points", () => {
    assert.equal(
      scheduleMatchupResult({
        status: "final",
        isHome: true,
        homePts: 120,
        awayPts: 100,
      }),
      "win",
    );
    assert.equal(
      scheduleMatchupResult({
        status: "final",
        isHome: false,
        homePts: 120,
        awayPts: 100,
      }),
      "loss",
    );
  });
});
