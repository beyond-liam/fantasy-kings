import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDefaultScoringRuleDefinitions } from "@/lib/leagues/scoring/defaults";
import { scoringStatKeysForLoad } from "@/lib/leagues/scoring/stat-keys";
import type {
  ScoringPosition,
  ScoringRuleDefinition,
} from "@/lib/leagues/scoring/types";

describe("scoringStatKeysForLoad", () => {
  it("includes offense keys and IDP aliases for default PPR", () => {
    const keys = scoringStatKeysForLoad(
      getDefaultScoringRuleDefinitions("full_ppr"),
    );

    assert.ok(keys.includes("pass_yd"));
    assert.ok(keys.includes("rec"));
    assert.ok(keys.includes("rush_yd"));
    if (keys.includes("sack")) {
      assert.ok(keys.includes("idp_sack"));
    }
  });

  it("adds FG buckets when kicker rules are present", () => {
    const rules: ScoringRuleDefinition[] = [
      {
        id: "fg",
        category: "kicking",
        kind: "simple",
        points: 3,
        stat: "Field Goal Made",
        positions: ["K" as ScoringPosition],
      },
    ];
    const keys = scoringStatKeysForLoad(rules);

    assert.ok(keys.includes("fgm"));
    assert.ok(keys.includes("fgm_50p"));
    assert.ok(keys.includes("xpm"));
  });

  it("includes IDP aliases for passes defended and QB hits", () => {
    const keys = scoringStatKeysForLoad([
      {
        id: "pd",
        category: "defense",
        kind: "simple",
        points: 1,
        stat: "Passes Defended",
        positions: ["CB"],
      },
      {
        id: "qbh",
        category: "defense",
        kind: "simple",
        points: 0.5,
        stat: "QB Hits",
        positions: ["DE"],
      },
    ]);

    assert.ok(keys.includes("pass_def"));
    assert.ok(keys.includes("idp_pass_def"));
    assert.ok(keys.includes("qb_hit"));
    assert.ok(keys.includes("idp_qb_hit"));
  });
});
