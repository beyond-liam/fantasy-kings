import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  expectedPlayerPoints,
  formatWinChancePct,
  matchupWinChance,
  normalCdf,
  parseDisplayClockMinutes,
  resolveGameProgress,
} from "@/lib/leagues/win-probability";

describe("game progress", () => {
  it("parses ESPN clocks", () => {
    assert.equal(parseDisplayClockMinutes("15:00"), 15);
    assert.equal(parseDisplayClockMinutes("7:30"), 7.5);
    assert.equal(parseDisplayClockMinutes("0:00"), 0);
  });

  it("keeps pre-game at 0 and final at 1", () => {
    assert.equal(resolveGameProgress({ status: "pre" }).fractionPlayed, 0);
    assert.equal(resolveGameProgress({ status: "post" }).fractionPlayed, 1);
  });

  it("maps Q1 kickoff clock to ~0 remaining fraction played start", () => {
    const start = resolveGameProgress({
      status: "in",
      period: 1,
      displayClock: "15:00",
    });
    assert.ok(start.fractionPlayed < 0.01);
  });

  it("maps end of Q2 to about half remaining", () => {
    const half = resolveGameProgress({
      status: "in",
      period: 2,
      displayClock: "0:00",
    });
    assert.ok(Math.abs(half.fractionPlayed - 0.5) < 0.02);
  });
});

describe("expected player points", () => {
  it("uses projection before kickoff even when actual is 0", () => {
    const result = expectedPlayerPoints(
      {
        id: "1",
        primaryPositionId: "RB",
        nflTeam: "KC",
        projectedPts: 12,
        actualPts: 0,
      },
      { status: "pre", fractionPlayed: 0 },
    );
    assert.equal(result.mean, 12);
    assert.ok(result.variance > 0);
  });

  it("at kickoff live uses full projection remainder", () => {
    const result = expectedPlayerPoints(
      {
        id: "1",
        primaryPositionId: "RB",
        nflTeam: "KC",
        projectedPts: 12,
        actualPts: 0,
      },
      { status: "in", fractionPlayed: 0 },
    );
    assert.equal(result.mean, 12);
  });

  it("blends actual + remaining mid-game", () => {
    const result = expectedPlayerPoints(
      {
        id: "1",
        primaryPositionId: "RB",
        nflTeam: "KC",
        projectedPts: 12,
        actualPts: 8,
      },
      { status: "in", fractionPlayed: 0.5 },
    );
    assert.equal(result.mean, 14);
  });

  it("locks to actual when final", () => {
    const result = expectedPlayerPoints(
      {
        id: "1",
        primaryPositionId: "RB",
        nflTeam: "KC",
        projectedPts: 12,
        actualPts: 9.5,
      },
      { status: "post", fractionPlayed: 1 },
    );
    assert.equal(result.mean, 9.5);
    assert.equal(result.variance, 0);
  });
});

describe("matchup win chance", () => {
  it("gives favorite above 50%", () => {
    const progress = new Map();
    const result = matchupWinChance({
      focusStarters: [
        {
          id: "a",
          primaryPositionId: "QB",
          nflTeam: "KC",
          projectedPts: 20,
          actualPts: null,
        },
      ],
      opponentStarters: [
        {
          id: "b",
          primaryPositionId: "QB",
          nflTeam: "BUF",
          projectedPts: 12,
          actualPts: null,
        },
      ],
      progressByNflTeam: progress,
    });
    assert.ok(result.winProbability > 0.5);
    assert.equal(formatWinChancePct(result.winProbability).endsWith("%"), true);
  });

  it("normalCdf is ~0.5 at 0", () => {
    assert.ok(Math.abs(normalCdf(0) - 0.5) < 0.001);
  });
});
