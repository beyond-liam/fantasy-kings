import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatProjectionPerGame,
  getProjectionHighlightStats,
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

  it("tiers counting stats by per-game pace when gamesPlayed is set", () => {
    // TE elite rec pace ≈ 75/17 ≈ 4.4/g — 24 over 4g = 6/g stays success.
    assert.equal(
      getProjectionStatAccentTone({
        key: "rec",
        value: 24,
        position: "TE",
        gamesPlayed: 4,
      }),
      "success",
    );
    // Same 24 without pace → below TE borderline 40 → destructive.
    assert.equal(
      getProjectionStatAccentTone({
        key: "rec",
        value: 24,
        position: "TE",
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

describe("getProjectionHighlightStats with gamesPlayed", () => {
  it("adds per-game averages for counting tiles", () => {
    const tiles = getProjectionHighlightStats(
      {
        primaryPositionId: "TE",
        positionRank: null,
        seasonProjection: null,
        seasonStats: {
          fantasyPts: 53.6,
          stats: { rec: 24, rec_yd: 234, rec_td: 1, rec_tgt: 35 },
        },
      },
      { gamesPlayed: 4, usePositionRankForFpts: false },
    );
    const rec = tiles.find((t) => t.key === "rec");
    assert.ok(rec);
    assert.equal(rec?.value, 24);
    assert.equal(rec?.perGame, 6);
    assert.equal(rec?.accentTone, "success");
    const ypr = tiles.find((t) => t.key === "ypr");
    assert.equal(ypr?.perGame, undefined);
  });

  it("builds IDP production tiles", () => {
    const tiles = getProjectionHighlightStats(
      {
        primaryPositionId: "DE",
        positionRank: 5,
        seasonProjection: null,
        seasonStats: {
          fantasyPts: 110,
          stats: {
            tkl_solo: 40,
            tkl_ast: 15,
            sack: 11,
            tkl_loss: 14,
            int: 0,
            ff: 3,
          },
        },
      },
      { gamesPlayed: 10, usePositionRankForFpts: false },
    );
    assert.deepEqual(
      tiles.map((t) => t.key),
      ["tkl", "tkl_loss", "sack", "int", "ff", "fpts_weekly"],
    );
    assert.equal(tiles.find((t) => t.key === "tkl")?.value, 55);
    assert.equal(tiles.find((t) => t.key === "sack")?.perGame, 1.1);
  });
});

describe("formatProjectionPerGame", () => {
  it("formats pace with /g", () => {
    assert.equal(formatProjectionPerGame(7.411), "7.4/g");
    assert.equal(formatProjectionPerGame(0.65), "0.65/g");
    assert.equal(formatProjectionPerGame(null), null);
  });
});
