import { describe, expect, it } from "vitest";
import { allStartersFinal } from "./week-matchup-board";
import type { GameProgress, WinProbPlayer } from "./week-matchup-board";

describe("allStartersFinal", () => {
  it("returns false for empty lineup", () => {
    const progress = new Map<string, GameProgress>();
    expect(allStartersFinal([], progress)).toBe(false);
  });

  it("returns true when all starters have post status", () => {
    const lineup: WinProbPlayer[] = [
      { playerId: "1", nflTeam: "SF", actualPts: 10, projectedPts: 8 },
      { playerId: "2", nflTeam: "KC", actualPts: 12, projectedPts: 10 },
    ];
    const progress = new Map<string, GameProgress>([
      ["SF", { status: "post", clock: "", period: "" }],
      ["KC", { status: "post", clock: "", period: "" }],
    ]);
    expect(allStartersFinal(lineup, progress)).toBe(true);
  });

  it("returns false when any starter has in status", () => {
    const lineup: WinProbPlayer[] = [
      { playerId: "1", nflTeam: "SF", actualPts: 10, projectedPts: 8 },
      { playerId: "2", nflTeam: "KC", actualPts: 12, projectedPts: 10 },
    ];
    const progress = new Map<string, GameProgress>([
      ["SF", { status: "post", clock: "", period: "" }],
      ["KC", { status: "in", clock: "12:30", period: "Q3" }],
    ]);
    expect(allStartersFinal(lineup, progress)).toBe(false);
  });

  it("treats missing progress as final (current behavior)", () => {
    const lineup: WinProbPlayer[] = [
      { playerId: "1", nflTeam: "SF", actualPts: 10, projectedPts: 8 },
      { playerId: "2", nflTeam: "KC", actualPts: 12, projectedPts: 10 },
    ];
    const progress = new Map<string, GameProgress>([
      ["SF", { status: "post", clock: "", period: "" }],
      // KC missing from progress map
    ]);
    expect(allStartersFinal(lineup, progress)).toBe(true);
  });
});
