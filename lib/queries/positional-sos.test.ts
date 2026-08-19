import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDefaultScoringRuleDefinitions } from "@/lib/leagues/scoring/defaults";
import {
  getPositionalSosTableResult,
  type PositionalSosDeps,
} from "@/lib/queries/positional-sos";
import type { SleeperNflState } from "@/lib/sleeper/api";

const RULES = getDefaultScoringRuleDefinitions("full_ppr");
const NFL_STATE: SleeperNflState = {
  season: "2025",
  previous_season: "2024",
  season_type: "regular",
  week: 1,
  display_week: 1,
};

describe("getPositionalSosTableResult", () => {
  it("returns typed failure when a dependency throws", async () => {
    const deps: PositionalSosDeps = {
      getNflState: async () => NFL_STATE,
      loadPtsAllowedWeekTotals: async () => {
        throw new Error("schedule fetch failed");
      },
    };

    const result = await getPositionalSosTableResult(
      {
        season: "2025",
        positionIds: ["QB"],
        rules: RULES,
      },
      deps,
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.message, "schedule fetch failed");
  });

  it("returns an empty table when no positions are requested", async () => {
    const result = await getPositionalSosTableResult({
      season: "2025",
      positionIds: [],
      rules: RULES,
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.table.size, 0);
  });
});
