import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  weeklyRanksByWeekFromFinals,
  buildScheduleDisplayRows,
} from "@/lib/leagues/schedule-display";

describe("weeklyRanksByWeekFromFinals", () => {
  it("ranks the focus team by weekly points", () => {
    const ranks = weeklyRanksByWeekFromFinals(
      [
        {
          week: 1,
          homeTeamId: "a",
          awayTeamId: "b",
          homePts: 120,
          awayPts: 100,
        },
        {
          week: 1,
          homeTeamId: "c",
          awayTeamId: "d",
          homePts: 110,
          awayPts: 90,
        },
      ],
      "a",
    );
    assert.equal(ranks.get(1), 1);
  });

  it("shares rank on near-ties", () => {
    const ranks = weeklyRanksByWeekFromFinals(
      [
        {
          week: 2,
          homeTeamId: "a",
          awayTeamId: "b",
          homePts: 100,
          awayPts: 100.02,
        },
        {
          week: 2,
          homeTeamId: "c",
          awayTeamId: "d",
          homePts: 80,
          awayPts: 70,
        },
      ],
      "a",
    );
    assert.equal(ranks.get(2), 1);
  });
});

describe("buildScheduleDisplayRows", () => {
  it("attaches weekly rank and win chance", () => {
    const rows = buildScheduleDisplayRows({
      rows: [
        {
          id: "m1",
          publicId: "pub",
          week: 1,
          opponentTeamId: "opp",
          opponentName: "Opp",
          opponentSlug: "opp",
          opponentLogoUrl: null,
          isHome: true,
          status: "final",
          homePts: 120,
          awayPts: 100,
        },
      ],
      weekRangeByNumber: new Map([[1, "Sep 1–7"]]),
      records: new Map([["opp", { wins: 1, losses: 0, ties: 0 }]]),
      winChances: new Map([["m1", 0.62]]),
      weeklyRanksByWeek: new Map([[1, 3]]),
    });
    assert.equal(rows[0]?.weeklyRank, 3);
    assert.equal(rows[0]?.winChance, 0.62);
    assert.equal(rows[0]?.result, "win");
  });
});
