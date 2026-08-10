import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sortRankedPlayers } from "@/lib/rankings/sort-ranked-players";

function row(partial: {
  fullName: string;
  fantasyPts?: number | null;
  positionRank?: number | null;
  stats?: Record<string, number | null>;
}) {
  return {
    fantasyPts: null as number | null,
    positionRank: null as number | null,
    stats: {} as Record<string, number | null>,
    ...partial,
  };
}

describe("sortRankedPlayers", () => {
  it("pages position ranks with S1 first when ascending", () => {
    const sorted = sortRankedPlayers(
      [
        row({ fullName: "Conner", positionRank: 3 }),
        row({ fullName: "Hamlin", positionRank: 85 }),
        row({ fullName: "Hamilton", positionRank: 1 }),
        row({ fullName: "Unknown", positionRank: null }),
      ],
      "positionRank",
      false,
    );

    assert.deepEqual(
      sorted.map((r) => r.fullName),
      ["Hamilton", "Conner", "Hamlin", "Unknown"],
    );
  });

  it("sorts fantasy points descending by default", () => {
    const sorted = sortRankedPlayers([
      row({ fullName: "B", fantasyPts: 10 }),
      row({ fullName: "A", fantasyPts: 20 }),
      row({ fullName: "C", fantasyPts: 10 }),
    ]);

    assert.deepEqual(
      sorted.map((r) => r.fullName),
      ["A", "B", "C"],
    );
  });
});
