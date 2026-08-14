import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  attachPositionRanks,
  buildHybridPositionRankById,
  hasFantasyProduction,
} from "@/lib/rankings/attach-position-ranks";

function row(partial: {
  id: string;
  primaryPositionId: string;
  fantasyPts: number | null;
  stats?: Record<string, number | null>;
}) {
  return {
    positionRank: null as number | null,
    stats: {} as Record<string, number | null>,
    ...partial,
  };
}

describe("hasFantasyProduction", () => {
  it("is true when any scored row has non-zero fantasy points", () => {
    assert.equal(
      hasFantasyProduction([
        { fantasyPts: 0 },
        { fantasyPts: 21.85 },
      ]),
      true,
    );
  });

  it("is false when every scored row is zero or null", () => {
    assert.equal(
      hasFantasyProduction([{ fantasyPts: 0 }, { fantasyPts: null }]),
      false,
    );
  });
});

describe("attachPositionRanks", () => {
  it("ranks by fantasy points within the provided rows", () => {
    const ranked = attachPositionRanks([
      row({ id: "a", primaryPositionId: "QB", fantasyPts: 300 }),
      row({ id: "b", primaryPositionId: "QB", fantasyPts: 200 }),
    ]);

    assert.equal(ranked.find((p) => p.id === "a")?.positionRank, 1);
    assert.equal(ranked.find((p) => p.id === "b")?.positionRank, 2);
  });

  it("makes the highest scorer QB1 even when projection ranks disagree", () => {
    const ranked = attachPositionRanks([
      row({ id: "allar", primaryPositionId: "QB", fantasyPts: 21.85 }),
      row({ id: "mendoza", primaryPositionId: "QB", fantasyPts: 9.45 }),
    ]);

    assert.equal(ranked.find((p) => p.id === "allar")?.positionRank, 1);
    assert.equal(ranked.find((p) => p.id === "mendoza")?.positionRank, 2);
  });

  it("uses league-wide fantasy ranks when a map is supplied", () => {
    const leagueRanks = new Map([
      ["stafford", 16],
      ["backup", 40],
    ]);

    const ranked = attachPositionRanks(
      [
        row({ id: "stafford", primaryPositionId: "QB", fantasyPts: 280 }),
        row({ id: "backup", primaryPositionId: "QB", fantasyPts: 120 }),
      ],
      leagueRanks,
    );

    assert.equal(ranked.find((p) => p.id === "stafford")?.positionRank, 16);
    assert.equal(ranked.find((p) => p.id === "backup")?.positionRank, 40);
  });

  it("ignores Sleeper pos_rank in favor of fantasy points", () => {
    const ranked = attachPositionRanks([
      row({
        id: "jackson",
        primaryPositionId: "CB",
        fantasyPts: 77,
        stats: { pos_rank_ppr: 2 },
      }),
      row({
        id: "lassiter",
        primaryPositionId: "CB",
        fantasyPts: 84.5,
        stats: { pos_rank_ppr: 3 },
      }),
    ]);

    assert.equal(ranked.find((p) => p.id === "lassiter")?.positionRank, 1);
    assert.equal(ranked.find((p) => p.id === "jackson")?.positionRank, 2);
  });

  it("uses an external map for empty preseason stats rows", () => {
    const ranked = attachPositionRanks(
      [
        row({
          id: "hamilton",
          primaryPositionId: "S",
          fantasyPts: 0,
          stats: { pos_rank_ppr: 457 },
        }),
      ],
      new Map([["hamilton", 3]]),
    );

    assert.equal(ranked[0]?.positionRank, 3);
  });
});

describe("buildHybridPositionRankById", () => {
  it("ranks scorers by actual points then fills remaining slots by projection", () => {
    const ranks = buildHybridPositionRankById([
      {
        id: "allar",
        fullName: "Drew Allar",
        primaryPositionId: "QB",
        actualPts: 21.85,
        projectedPts: 12,
        appeared: true,
      },
      {
        id: "richardson",
        fullName: "Anthony Richardson",
        primaryPositionId: "QB",
        actualPts: 14.55,
        projectedPts: 80,
        appeared: true,
      },
      {
        id: "allen",
        fullName: "Josh Allen",
        primaryPositionId: "QB",
        actualPts: 0,
        projectedPts: 397,
        appeared: false,
      },
      {
        id: "jackson",
        fullName: "Lamar Jackson",
        primaryPositionId: "QB",
        actualPts: null,
        projectedPts: 361.8,
        appeared: false,
      },
    ]);

    assert.equal(ranks.get("allar"), 1);
    assert.equal(ranks.get("richardson"), 2);
    assert.equal(ranks.get("allen"), 3);
    assert.equal(ranks.get("jackson"), 4);
  });

  it("places the top projected unplayed player first among remaining ranks", () => {
    const scored = Array.from({ length: 10 }, (_, index) => ({
      id: `played-${index}`,
      fullName: `Played ${index}`,
      primaryPositionId: "QB",
      actualPts: 20 - index,
      projectedPts: 10,
      appeared: true,
    }));
    const ranks = buildHybridPositionRankById([
      ...scored,
      {
        id: "allen",
        fullName: "Josh Allen",
        primaryPositionId: "QB",
        actualPts: 0,
        projectedPts: 397,
        appeared: false,
      },
      {
        id: "backup",
        fullName: "Backup",
        primaryPositionId: "QB",
        actualPts: 0,
        projectedPts: 50,
        appeared: false,
      },
    ]);

    assert.equal(ranks.get("played-0"), 1);
    assert.equal(ranks.get("played-9"), 10);
    assert.equal(ranks.get("allen"), 11);
    assert.equal(ranks.get("backup"), 12);
  });

  it("keeps a 0-point appearance in the played group", () => {
    const ranks = buildHybridPositionRankById([
      {
        id: "drones",
        fullName: "Kyron Drones",
        primaryPositionId: "QB",
        actualPts: 0,
        projectedPts: 2,
        appeared: true,
      },
      {
        id: "allen",
        fullName: "Josh Allen",
        primaryPositionId: "QB",
        actualPts: null,
        projectedPts: 397,
        appeared: false,
      },
    ]);

    assert.equal(ranks.get("drones"), 1);
    assert.equal(ranks.get("allen"), 2);
  });

  it("ranks the projected QB1 after every quarterback who has appeared", () => {
    const played = Array.from({ length: 32 }, (_, index) => ({
      id: `played-${index}`,
      fullName: `Played ${String(index).padStart(2, "0")}`,
      primaryPositionId: "QB",
      actualPts: 32 - index,
      projectedPts: 1,
      appeared: true,
    }));
    const ranks = buildHybridPositionRankById([
      ...played,
      {
        id: "allen",
        fullName: "Josh Allen",
        primaryPositionId: "QB",
        actualPts: null,
        projectedPts: 397,
        appeared: false,
      },
    ]);

    assert.equal(ranks.get("played-0"), 1);
    assert.equal(ranks.get("played-31"), 32);
    assert.equal(ranks.get("allen"), 33);
  });

  it("ranks a negative score below every player on 0, played or not", () => {
    const ranks = buildHybridPositionRankById([
      {
        id: "love",
        fullName: "Jordan Love",
        primaryPositionId: "QB",
        actualPts: 0.9,
        projectedPts: 20,
        appeared: true,
      },
      {
        id: "drones",
        fullName: "Kyron Drones",
        primaryPositionId: "QB",
        actualPts: 0,
        projectedPts: 2,
        appeared: true,
      },
      {
        id: "hooker",
        fullName: "Hendon Hooker",
        primaryPositionId: "QB",
        actualPts: -1.35,
        projectedPts: 8,
        appeared: true,
      },
      {
        id: "hurts",
        fullName: "Jalen Hurts",
        primaryPositionId: "QB",
        actualPts: null,
        projectedPts: 280,
        appeared: false,
      },
      {
        id: "allen",
        fullName: "Josh Allen",
        primaryPositionId: "QB",
        actualPts: null,
        projectedPts: 397,
        appeared: false,
      },
    ]);

    assert.equal(ranks.get("love"), 1);
    assert.equal(ranks.get("drones"), 2);
    assert.equal(ranks.get("allen"), 3);
    assert.equal(ranks.get("hurts"), 4);
    assert.equal(ranks.get("hooker"), 5);
  });
});
