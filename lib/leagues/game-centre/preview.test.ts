import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildInjuryReport,
  buildSeasonLeaders,
} from "@/lib/leagues/game-centre/preview";

function player(
  overrides: Partial<{
    fullName: string;
    primaryPositionId: string;
    sleeperId: string | null;
    nflTeam: string | null;
    injuryStatus: string | null;
    projectedPts: number | null;
    seasonProjectedPts: number | null;
    isStarter: boolean;
  }> = {},
) {
  return {
    fullName: "Player",
    primaryPositionId: "QB",
    sleeperId: null,
    nflTeam: null,
    injuryStatus: null,
    projectedPts: null,
    seasonProjectedPts: null,
    isStarter: true,
    ...overrides,
  };
}

describe("game centre preview helpers", () => {
  it("builds season leaders by primary position with full category labels", () => {
    const leaders = buildSeasonLeaders(
      [
        player({
          fullName: "Away QB",
          primaryPositionId: "QB",
          seasonProjectedPts: 280,
          projectedPts: 18,
        }),
        player({
          fullName: "Away RB",
          primaryPositionId: "RB",
          seasonProjectedPts: 200,
          projectedPts: 12,
        }),
      ],
      [
        player({
          fullName: "Home QB",
          primaryPositionId: "QB",
          seasonProjectedPts: 300,
          projectedPts: 20,
        }),
      ],
    );
    assert.equal(leaders[0]?.category, "Quarterback");
    assert.equal(leaders[0]?.away.name, "Away QB");
    assert.equal(leaders[0]?.home.name, "Home QB");
    assert.equal(leaders[0]?.away.primaryPositionId, "QB");
    assert.equal(
      leaders.some((row) => row.category === "Running Back"),
      true,
    );
  });

  it("lists injured starters only", () => {
    const rows = buildInjuryReport(
      [
        player({
          fullName: "Hurt",
          primaryPositionId: "WR",
          injuryStatus: "Out",
          projectedPts: 8,
        }),
        player({
          fullName: "Fine",
          primaryPositionId: "RB",
          projectedPts: 10,
        }),
      ],
      [
        player({
          fullName: "Q",
          primaryPositionId: "TE",
          injuryStatus: "Questionable",
          projectedPts: 7,
        }),
      ],
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.playerName, "Hurt");
    assert.equal(rows[1]?.tone, "questionable");
  });
});
