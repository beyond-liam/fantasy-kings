import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { attachPositionRanks } from "@/lib/rankings/attach-position-ranks";

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

describe("attachPositionRanks", () => {
  it("falls back to fantasy ranks within the provided rows", () => {
    const ranked = attachPositionRanks([
      row({ id: "a", primaryPositionId: "QB", fantasyPts: 300 }),
      row({ id: "b", primaryPositionId: "QB", fantasyPts: 200 }),
    ]);

    assert.equal(ranked.find((p) => p.id === "a")?.positionRank, 1);
    assert.equal(ranked.find((p) => p.id === "b")?.positionRank, 2);
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

  it("prefers valid Sleeper position ranks over fantasy fallback", () => {
    const ranked = attachPositionRanks(
      [
        row({
          id: "stafford",
          primaryPositionId: "QB",
          fantasyPts: 280,
          stats: { pos_rank_ppr: 16 },
        }),
      ],
      new Map([["stafford", 2]]),
    );

    assert.equal(ranked[0]?.positionRank, 16);
  });
});
