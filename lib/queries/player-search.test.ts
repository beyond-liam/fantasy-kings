import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolvePlayerSearchSource } from "@/lib/queries/player-search";

const withPre = {
  playEachOtherTimes: 1 as const,
  includePreseason: true,
  preseasonStartWeek: 1,
};

const withoutPre = {
  playEachOtherTimes: 1 as const,
  includePreseason: false,
  preseasonStartWeek: 1,
};

describe("resolvePlayerSearchSource", () => {
  it("uses projections before the league's counting season starts", () => {
    assert.deepEqual(
      resolvePlayerSearchSource(
        {
          season: "2026",
          previous_season: "2025",
          season_type: "pre",
          week: 3,
          display_week: 3,
        },
        withoutPre,
      ),
      { kind: "projection", week: 0, seasonType: "regular" },
    );

    assert.deepEqual(
      resolvePlayerSearchSource({
        season: "2026",
        previous_season: "2025",
        season_type: "regular",
        week: 0,
        display_week: 0,
      }),
      { kind: "projection", week: 0, seasonType: "regular" },
    );
  });

  it("uses current-week stats once regular season has started", () => {
    assert.deepEqual(
      resolvePlayerSearchSource({
        season: "2026",
        previous_season: "2025",
        season_type: "regular",
        week: 1,
        display_week: 1,
      }),
      { kind: "stats", week: 1, seasonType: "regular" },
    );
  });

  it("uses preseason stats when the league includes those weeks", () => {
    assert.deepEqual(
      resolvePlayerSearchSource(
        {
          season: "2026",
          previous_season: "2025",
          season_type: "pre",
          week: 2,
          display_week: 2,
        },
        withPre,
      ),
      { kind: "stats", week: 2, seasonType: "pre" },
    );
  });

  it("uses projections on global search until the NFL regular season", () => {
    assert.deepEqual(
      resolvePlayerSearchSource({
        season: "2026",
        previous_season: "2025",
        season_type: "pre",
        week: 2,
        display_week: 2,
      }),
      { kind: "projection", week: 0, seasonType: "regular" },
    );
  });
});
