import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeSosByTeam,
  computeTeamSos,
  formatSos,
  projectedWinPctFromStrength,
  resolveTeamStrengthForSos,
} from "@/lib/leagues/sos";

describe("projectedWinPctFromStrength", () => {
  it("ranks the higher-PF team above .500", () => {
    const winPct = projectedWinPctFromStrength(
      new Map([
        ["a", 120],
        ["b", 100],
      ]),
    );
    assert.ok((winPct.get("a") ?? 0) > 0.5);
    assert.ok((winPct.get("b") ?? 0) < 0.5);
  });

  it("returns .500 when all strengths are zero", () => {
    const winPct = projectedWinPctFromStrength(
      new Map([
        ["a", 0],
        ["b", 0],
      ]),
    );
    assert.equal(winPct.get("a"), 0.5);
    assert.equal(winPct.get("b"), 0.5);
  });
});

describe("computeTeamSos", () => {
  it("averages opponent projected win percentages", () => {
    const sos = computeTeamSos({
      playedOpponentIds: [],
      remainingOpponentIds: ["a", "b"],
      projectedWinPctByTeamId: new Map([
        ["a", 0.6],
        ["b", 0.4],
      ]),
    });
    assert.equal(sos.remaining, 0.5);
    assert.equal(sos.overall, 0.5);
    assert.equal(sos.played, null);
  });

  it("matches overall and remaining when nothing is played", () => {
    const map = computeSosByTeam({
      matchups: [
        {
          week: 1,
          homeTeamId: "a",
          awayTeamId: "b",
          played: false,
        },
        {
          week: 2,
          homeTeamId: "a",
          awayTeamId: "c",
          played: false,
        },
      ],
      strengthByTeamId: new Map([
        ["a", 110],
        ["b", 100],
        ["c", 90],
      ]),
    });
    assert.equal(map.get("a")?.overall, map.get("a")?.remaining);
    assert.ok((map.get("a")?.overall ?? 0) > 0);
  });
});

describe("resolveTeamStrengthForSos", () => {
  it("prefers actual PF/G when present", () => {
    const strength = resolveTeamStrengthForSos({
      teamIds: ["a"],
      pointsForAvgByTeamId: new Map([["a", 115]]),
      projectedWeeklyPfByTeamId: new Map([["a", 100]]),
    });
    assert.equal(strength.get("a"), 115);
  });

  it("falls back to projected weekly PF pre-season", () => {
    const strength = resolveTeamStrengthForSos({
      teamIds: ["a"],
      pointsForAvgByTeamId: new Map([["a", 0]]),
      projectedWeeklyPfByTeamId: new Map([["a", 108]]),
    });
    assert.equal(strength.get("a"), 108);
  });
});

describe("formatSos", () => {
  it("formats like win percentage", () => {
    assert.equal(formatSos(0.714), ".714");
    assert.equal(formatSos(null), null);
  });
});
