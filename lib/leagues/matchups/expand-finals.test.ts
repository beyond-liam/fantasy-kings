import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { expandFinalMatchupRows } from "./expand-finals.js";

describe("expandFinalMatchupRows", () => {
  it("returns empty array for empty input", () => {
    const result = expandFinalMatchupRows([]);
    assert.deepEqual(result, []);
  });

  it("expands single matchup into two team rows", () => {
    const result = expandFinalMatchupRows([
      {
        week: 1,
        homeTeamId: "team-a",
        awayTeamId: "team-b",
        homePts: 120.5,
        awayPts: 110.3,
      },
    ]);

    assert.deepEqual(result, [
      { week: 1, teamId: "team-a", pts: 120.5 },
      { week: 1, teamId: "team-b", pts: 110.3 },
    ]);
  });

  it("expands multiple matchups preserving order", () => {
    const result = expandFinalMatchupRows([
      {
        week: 1,
        homeTeamId: "team-a",
        awayTeamId: "team-b",
        homePts: 120,
        awayPts: 110,
      },
      {
        week: 2,
        homeTeamId: "team-c",
        awayTeamId: "team-d",
        homePts: 95,
        awayPts: 100,
      },
    ]);

    assert.deepEqual(result, [
      { week: 1, teamId: "team-a", pts: 120 },
      { week: 1, teamId: "team-b", pts: 110 },
      { week: 2, teamId: "team-c", pts: 95 },
      { week: 2, teamId: "team-d", pts: 100 },
    ]);
  });

  it("filters out matchups with null homePts", () => {
    const result = expandFinalMatchupRows([
      {
        week: 1,
        homeTeamId: "team-a",
        awayTeamId: "team-b",
        homePts: null,
        awayPts: 110,
      },
      {
        week: 2,
        homeTeamId: "team-c",
        awayTeamId: "team-d",
        homePts: 95,
        awayPts: 100,
      },
    ]);

    assert.deepEqual(result, [
      { week: 2, teamId: "team-c", pts: 95 },
      { week: 2, teamId: "team-d", pts: 100 },
    ]);
  });

  it("filters out matchups with null awayPts", () => {
    const result = expandFinalMatchupRows([
      {
        week: 1,
        homeTeamId: "team-a",
        awayTeamId: "team-b",
        homePts: 120,
        awayPts: null,
      },
      {
        week: 2,
        homeTeamId: "team-c",
        awayTeamId: "team-d",
        homePts: 95,
        awayPts: 100,
      },
    ]);

    assert.deepEqual(result, [
      { week: 2, teamId: "team-c", pts: 95 },
      { week: 2, teamId: "team-d", pts: 100 },
    ]);
  });

  it("filters out matchups with both pts null", () => {
    const result = expandFinalMatchupRows([
      {
        week: 1,
        homeTeamId: "team-a",
        awayTeamId: "team-b",
        homePts: null,
        awayPts: null,
      },
      {
        week: 2,
        homeTeamId: "team-c",
        awayTeamId: "team-d",
        homePts: 95,
        awayPts: 100,
      },
    ]);

    assert.deepEqual(result, [
      { week: 2, teamId: "team-c", pts: 95 },
      { week: 2, teamId: "team-d", pts: 100 },
    ]);
  });

  it("handles tied matchups (equal pts)", () => {
    const result = expandFinalMatchupRows([
      {
        week: 1,
        homeTeamId: "team-a",
        awayTeamId: "team-b",
        homePts: 100.5,
        awayPts: 100.5,
      },
    ]);

    assert.deepEqual(result, [
      { week: 1, teamId: "team-a", pts: 100.5 },
      { week: 1, teamId: "team-b", pts: 100.5 },
    ]);
  });

  it("handles zero points", () => {
    const result = expandFinalMatchupRows([
      {
        week: 1,
        homeTeamId: "team-a",
        awayTeamId: "team-b",
        homePts: 0,
        awayPts: 50,
      },
    ]);

    assert.deepEqual(result, [
      { week: 1, teamId: "team-a", pts: 0 },
      { week: 1, teamId: "team-b", pts: 50 },
    ]);
  });

  it("handles mixed finalized and unfinalized matchups", () => {
    const result = expandFinalMatchupRows([
      {
        week: 1,
        homeTeamId: "team-a",
        awayTeamId: "team-b",
        homePts: 120,
        awayPts: 110,
      },
      {
        week: 1,
        homeTeamId: "team-c",
        awayTeamId: "team-d",
        homePts: null,
        awayPts: null,
      },
      {
        week: 2,
        homeTeamId: "team-a",
        awayTeamId: "team-c",
        homePts: 95,
        awayPts: 100,
      },
    ]);

    assert.deepEqual(result, [
      { week: 1, teamId: "team-a", pts: 120 },
      { week: 1, teamId: "team-b", pts: 110 },
      { week: 2, teamId: "team-a", pts: 95 },
      { week: 2, teamId: "team-c", pts: 100 },
    ]);
  });
});
