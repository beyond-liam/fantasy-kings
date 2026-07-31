import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolvePlayerSearchSource } from "@/lib/queries/player-search";

describe("resolvePlayerSearchSource", () => {
  it("uses projections before regular-season week 1", () => {
    assert.deepEqual(
      resolvePlayerSearchSource({
        season: "2026",
        previous_season: "2025",
        season_type: "pre",
        week: 3,
        display_week: 3,
      }),
      { kind: "projection", week: 0 },
    );

    assert.deepEqual(
      resolvePlayerSearchSource({
        season: "2026",
        previous_season: "2025",
        season_type: "regular",
        week: 0,
        display_week: 0,
      }),
      { kind: "projection", week: 0 },
    );
  });

  it("uses season stats once week 1 has started", () => {
    assert.deepEqual(
      resolvePlayerSearchSource({
        season: "2026",
        previous_season: "2025",
        season_type: "regular",
        week: 1,
        display_week: 1,
      }),
      { kind: "stats", week: 0 },
    );
  });
});
