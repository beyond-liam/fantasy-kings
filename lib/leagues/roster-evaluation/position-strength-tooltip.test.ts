import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPositionStrengthTooltipParts } from "@/lib/leagues/roster-evaluation/position-strength-tooltip";
import type { PositionStrengthPoint } from "@/lib/leagues/roster-evaluation/types";

function point(
  partial: Partial<PositionStrengthPoint> & Pick<PositionStrengthPoint, "position">,
): PositionStrengthPoint {
  return {
    starters: 100,
    bench: 50,
    startersRank: 1,
    benchRank: 2,
    hasStarters: true,
    hasBench: true,
    ...partial,
  };
}

describe("buildPositionStrengthTooltipParts", () => {
  it("describes starter and bench ranks against the league", () => {
    const parts = buildPositionStrengthTooltipParts(
      point({ position: "QB", startersRank: 1, benchRank: 2 }),
    );
    assert.deepEqual(
      parts.map((part) =>
        part.kind === "rank" ? `*${part.value}*` : part.value,
      ),
      [
        "Your starting QB ranks ",
        "*1st*",
        " against the league while your bench ranks ",
        "*2nd*",
        ".",
      ],
    );
  });

  it("notes missing bench instead of inventing a rank", () => {
    const parts = buildPositionStrengthTooltipParts(
      point({
        position: "K",
        startersRank: 2,
        hasBench: false,
        bench: 0,
      }),
    );
    assert.equal(
      parts.map((part) => part.value).join(""),
      "Your starting K ranks 2nd against the league. You have no bench K.",
    );
  });
});
