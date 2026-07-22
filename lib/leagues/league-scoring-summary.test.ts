import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildLeagueScoringSummary } from "@/lib/leagues/league-scoring-summary";

describe("buildLeagueScoringSummary", () => {
  it("groups default full PPR rules by category", () => {
    const summary = buildLeagueScoringSummary({
      scoringPreset: "full_ppr",
    });

    assert.equal(summary.presetLabel, "Full PPR");
    assert.ok(summary.sections.length > 0);
    assert.equal(summary.sections[0]?.title, "Passing");
    assert.ok(
      summary.sections.some((section) => section.title === "Receiving"),
    );
    const receiving = summary.sections.find(
      (section) => section.title === "Receiving",
    );
    assert.ok(
      receiving?.rules.some((rule) =>
        rule.segments.some(
          (segment) =>
            segment.type === "stat" &&
            String(segment.value).toLowerCase().includes("reception"),
        ),
      ),
    );
  });

  it("omits empty categories", () => {
    const summary = buildLeagueScoringSummary({
      scoringPreset: "standard",
      scoringRules: [
        {
          id: "pass-td",
          category: "passing",
          kind: "simple",
          points: 4,
          stat: "Passing TD",
          positions: ["QB"],
        },
      ],
    });

    assert.deepEqual(
      summary.sections.map((section) => section.title),
      ["Passing"],
    );
    assert.equal(summary.sections[0]?.rules.length, 1);
  });
});
