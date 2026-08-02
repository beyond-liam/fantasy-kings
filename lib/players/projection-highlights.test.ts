import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getProjectionStatAccentTone,
  getWeeklyProjectionAccentTone,
} from "@/lib/players/projection-highlights";

describe("getProjectionStatAccentTone", () => {
  it("tiers season counting stats by position thresholds", () => {
    assert.equal(
      getProjectionStatAccentTone({
        key: "pass_yd",
        value: 4300,
        position: "QB",
      }),
      "success",
    );
    assert.equal(
      getProjectionStatAccentTone({
        key: "pass_yd",
        value: 3700,
        position: "QB",
      }),
      "muted",
    );
    assert.equal(
      getProjectionStatAccentTone({
        key: "pass_yd",
        value: 3200,
        position: "QB",
      }),
      "warning",
    );
    assert.equal(
      getProjectionStatAccentTone({
        key: "pass_yd",
        value: 2500,
        position: "QB",
      }),
      "destructive",
    );
  });

  it("uses WR thresholds for receiving volume", () => {
    assert.equal(
      getProjectionStatAccentTone({
        key: "rec",
        value: 110,
        position: "WR",
      }),
      "success",
    );
    assert.equal(
      getProjectionStatAccentTone({
        key: "rec",
        value: 50,
        position: "WR",
      }),
      "destructive",
    );
  });

  it("defers fpts_weekly to rank when present", () => {
    assert.equal(
      getProjectionStatAccentTone({
        key: "fpts_weekly",
        value: 10,
        position: "QB",
        positionRank: 3,
      }),
      "success",
    );
  });
});

describe("getWeeklyProjectionAccentTone", () => {
  it("falls back to weekly PPG thresholds without rank", () => {
    assert.equal(
      getWeeklyProjectionAccentTone({
        weeklyPts: 21,
        position: "QB",
      }),
      "success",
    );
    assert.equal(
      getWeeklyProjectionAccentTone({
        weeklyPts: 12,
        position: "QB",
      }),
      "destructive",
    );
  });
});
