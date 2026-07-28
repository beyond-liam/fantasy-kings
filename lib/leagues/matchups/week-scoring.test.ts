import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allStartersFinal,
  isMatchupResultFinal,
} from "@/lib/leagues/matchups/week-scoring";
import type { GameProgress } from "@/lib/leagues/win-probability";

describe("allStartersFinal", () => {
  it("returns false for an empty lineup", () => {
    assert.equal(allStartersFinal([], new Map()), false);
  });

  it("fail-closes when progress is missing", () => {
    assert.equal(
      allStartersFinal([{ nflTeam: "KC" }], new Map()),
      false,
    );
  });

  it("returns true when every NFL team is post", () => {
    const progress = new Map<string, GameProgress>([
      ["KC", { status: "post", fractionPlayed: 1 }],
      ["BUF", { status: "post", fractionPlayed: 1 }],
    ]);
    assert.equal(
      allStartersFinal([{ nflTeam: "KC" }, { nflTeam: "BUF" }], progress),
      true,
    );
  });
});

describe("isMatchupResultFinal", () => {
  const progress = new Map<string, GameProgress>([
    ["KC", { status: "post", fractionPlayed: 1 }],
  ]);

  it("is false when either side lacks actuals", () => {
    assert.equal(
      isMatchupResultFinal({
        week: 1,
        currentWeek: 2,
        awayActualPts: null,
        homeActualPts: 10,
        starters: [{ nflTeam: "KC" }],
        progressByNflTeam: progress,
      }),
      false,
    );
  });

  it("is true for a past week once both sides have actuals", () => {
    assert.equal(
      isMatchupResultFinal({
        week: 1,
        currentWeek: 2,
        awayActualPts: 80,
        homeActualPts: 90,
        starters: [{ nflTeam: "KC" }],
        progressByNflTeam: new Map(),
      }),
      true,
    );
  });

  it("requires starter games finished in the current week", () => {
    assert.equal(
      isMatchupResultFinal({
        week: 3,
        currentWeek: 3,
        awayActualPts: 80,
        homeActualPts: 90,
        starters: [{ nflTeam: "KC" }],
        progressByNflTeam: new Map([
          ["KC", { status: "in", fractionPlayed: 0.5 }],
        ]),
      }),
      false,
    );
    assert.equal(
      isMatchupResultFinal({
        week: 3,
        currentWeek: 3,
        awayActualPts: 80,
        homeActualPts: 90,
        starters: [{ nflTeam: "KC" }],
        progressByNflTeam: progress,
      }),
      true,
    );
  });
});
