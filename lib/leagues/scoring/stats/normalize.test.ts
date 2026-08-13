import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFENSE_STATS } from "@/lib/leagues/scoring/stats/defense";
import {
  catalogStatAllowsMultiple,
  getUsedCatalogCombos,
} from "@/lib/leagues/scoring/stats/normalize";

describe("catalogStatAllowsMultiple", () => {
  it("matches allowMultiple on defense catalog stats", () => {
    for (const stat of DEFENSE_STATS) {
      assert.equal(
        catalogStatAllowsMultiple(stat.label),
        Boolean(stat.allowMultiple),
        stat.label,
      );
    }
  });
});

describe("getUsedCatalogCombos", () => {
  it("still marks non-tier stats as used", () => {
    const used = getUsedCatalogCombos(
      [
        {
          id: "1",
          category: "defense",
          stat: "Sacks",
          kind: "per_every",
        },
      ],
      { category: "defense" },
    );
    assert.equal(used.has("Sacks::per_every"), true);
  });

  it("does not mark Points Allowed (or sub-stats) as used", () => {
    const used = getUsedCatalogCombos(
      [
        {
          id: "1",
          category: "defense",
          stat: "Points Allowed",
          kind: "threshold_between",
        },
        {
          id: "2",
          category: "defense",
          stat: "Points Allowed",
          kind: "threshold_between",
        },
        {
          id: "3",
          category: "defense",
          stat: "Offensive Points Allowed (FG, Pass TD, Rush TD)",
          kind: "threshold_lte",
        },
        {
          id: "4",
          category: "defense",
          stat: "Sacks",
          kind: "per_every",
        },
      ],
      { category: "defense" },
    );

    assert.equal(used.has("Points Allowed::threshold_between"), false);
    assert.equal(
      used.has(
        "Offensive Points Allowed (FG, Pass TD, Rush TD)::threshold_lte",
      ),
      false,
    );
    assert.equal(used.has("Sacks::per_every"), true);
  });
});
