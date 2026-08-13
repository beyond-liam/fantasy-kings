import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isScoreSyncSkip,
  resolveScoreSyncTarget,
} from "@/lib/scores/sync-calendar";
import type { SleeperNflState } from "@/lib/sleeper/api";

const preState: SleeperNflState = {
  season: "2026",
  previous_season: "2025",
  season_type: "pre",
  week: 1,
  display_week: 1,
};

describe("resolveScoreSyncTarget", () => {
  it("skips offseason without overrides", async () => {
    const result = await resolveScoreSyncTarget({
      state: {
        season: "2026",
        previous_season: "2025",
        season_type: "off",
        week: 0,
        display_week: 0,
      },
    });
    assert.equal(isScoreSyncSkip(result), true);
    if (isScoreSyncSkip(result)) {
      assert.equal(result.week, 0);
    }
  });

  it("uses ESPN preseason calendar week when Sleeper is still on HOF", async () => {
    const result = await resolveScoreSyncTarget({
      state: preState,
      now: new Date("2026-08-08T20:00:00.000Z"),
      loadPreseasonWeeks: async () => [
        {
          number: 1,
          startDate: new Date("2026-07-27T00:00:00.000Z"),
          endDate: new Date("2026-08-05T00:00:00.000Z"),
        },
        {
          number: 2,
          startDate: new Date("2026-08-05T00:00:00.000Z"),
          endDate: new Date("2026-08-12T00:00:00.000Z"),
        },
        {
          number: 3,
          startDate: new Date("2026-08-12T00:00:00.000Z"),
          endDate: new Date("2026-08-19T00:00:00.000Z"),
        },
      ],
    });
    assert.equal(isScoreSyncSkip(result), false);
    if (!isScoreSyncSkip(result)) {
      assert.deepEqual(result, {
        season: "2026",
        week: 2,
        seasonType: "pre",
      });
    }
  });

  it("bumps HOF week to Preseason Week 1 when calendar load fails", async () => {
    const result = await resolveScoreSyncTarget({
      state: preState,
      loadPreseasonWeeks: async () => {
        throw new Error("espn down");
      },
    });
    assert.equal(isScoreSyncSkip(result), false);
    if (!isScoreSyncSkip(result)) {
      assert.equal(result.week, 2);
      assert.equal(result.seasonType, "pre");
    }
  });

  it("honors week override during preseason", async () => {
    const result = await resolveScoreSyncTarget({
      state: preState,
      weekOverride: 3,
    });
    assert.deepEqual(result, {
      season: "2026",
      week: 3,
      seasonType: "pre",
    });
  });

  it("uses Sleeper display week for regular season", async () => {
    const result = await resolveScoreSyncTarget({
      state: {
        season: "2026",
        previous_season: "2025",
        season_type: "regular",
        week: 4,
        display_week: 4,
      },
    });
    assert.deepEqual(result, {
      season: "2026",
      week: 4,
      seasonType: "regular",
    });
  });
});
