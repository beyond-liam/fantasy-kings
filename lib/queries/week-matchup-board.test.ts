import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allStartersFinal } from "./lineup-finalization";

// Minimal fixtures for testing - match actual type shapes
type GameProgress = {
  status: "pre" | "in" | "post";
  fractionPlayed: number;
};

type WinProbPlayer = {
  id: string;
  primaryPositionId: string;
  nflTeam: string | null;
  actualPts: number | null;
  projectedPts: number | null;
};

describe("allStartersFinal", () => {
  it("returns false for empty lineup", () => {
    const progress = new Map<string, GameProgress>();
    assert.equal(allStartersFinal([], progress), false);
  });

  it("returns true when all starters have post status", () => {
    const lineup: WinProbPlayer[] = [
      {
        id: "1",
        primaryPositionId: "QB",
        nflTeam: "SF",
        actualPts: 10,
        projectedPts: 8,
      },
      {
        id: "2",
        primaryPositionId: "RB",
        nflTeam: "KC",
        actualPts: 12,
        projectedPts: 10,
      },
    ];
    const progress = new Map<string, GameProgress>([
      ["SF", { status: "post", fractionPlayed: 1 }],
      ["KC", { status: "post", fractionPlayed: 1 }],
    ]);
    assert.equal(allStartersFinal(lineup, progress), true);
  });

  it("returns false when any starter has in status", () => {
    const lineup: WinProbPlayer[] = [
      {
        id: "1",
        primaryPositionId: "QB",
        nflTeam: "SF",
        actualPts: 10,
        projectedPts: 8,
      },
      {
        id: "2",
        primaryPositionId: "RB",
        nflTeam: "KC",
        actualPts: 12,
        projectedPts: 10,
      },
    ];
    const progress = new Map<string, GameProgress>([
      ["SF", { status: "post", fractionPlayed: 1 }],
      ["KC", { status: "in", fractionPlayed: 0.5 }],
    ]);
    assert.equal(allStartersFinal(lineup, progress), false);
  });

  it("treats missing progress as NOT final (fail-closed)", () => {
    const lineup: WinProbPlayer[] = [
      {
        id: "1",
        primaryPositionId: "QB",
        nflTeam: "SF",
        actualPts: 10,
        projectedPts: 8,
      },
      {
        id: "2",
        primaryPositionId: "RB",
        nflTeam: "KC",
        actualPts: 12,
        projectedPts: 10,
      },
    ];
    const progress = new Map<string, GameProgress>([
      ["SF", { status: "post", fractionPlayed: 1 }],
      // KC missing from progress map
    ]);
    assert.equal(allStartersFinal(lineup, progress), false);
  });
});
