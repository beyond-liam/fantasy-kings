import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  currentNflScorePoint,
  playerTableWeekItems,
  resolvePlayerScorePoint,
} from "./player-score-point";

const preNfl = {
  season: "2026",
  season_type: "pre",
  week: 2,
  display_week: 2,
};

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

describe("currentNflScorePoint", () => {
  it("returns the live NFL week including preseason", () => {
    assert.deepEqual(currentNflScorePoint(preNfl), {
      seasonType: "pre",
      week: 2,
    });
  });

  it("bumps Hall of Fame to Preseason Week 1", () => {
    assert.deepEqual(
      currentNflScorePoint({
        season: "2026",
        season_type: "pre",
        week: 1,
        display_week: 1,
      }),
      { seasonType: "pre", week: 2 },
    );
  });

  it("returns null in the offseason", () => {
    assert.equal(
      currentNflScorePoint({
        season: "2026",
        season_type: "off",
        week: 0,
        display_week: 0,
      }),
      null,
    );
  });
});

describe("resolvePlayerScorePoint", () => {
  it("keeps projections on regular season totals", () => {
    assert.deepEqual(
      resolvePlayerScorePoint({
        selectedWeek: 0,
        kind: "projection",
        nfl: preNfl,
        schedule: withPre,
      }),
      { seasonType: "regular", week: 0 },
    );
  });

  it("uses Preseason Week 1 when Sleeper is still on Hall of Fame", () => {
    assert.deepEqual(
      resolvePlayerScorePoint({
        selectedWeek: 0,
        kind: "stats",
        nfl: {
          season: "2026",
          season_type: "pre",
          week: 1,
          display_week: 1,
        },
        schedule: withPre,
      }),
      { seasonType: "pre", week: 2 },
    );
  });

  it("stays on regular season totals when the league excludes preseason", () => {
    assert.deepEqual(
      resolvePlayerScorePoint({
        selectedWeek: 0,
        kind: "stats",
        nfl: preNfl,
        schedule: withoutPre,
      }),
      { seasonType: "regular", week: 0 },
    );
  });

  it("ignores NFL preseason on global Rankings (no schedule)", () => {
    assert.deepEqual(
      resolvePlayerScorePoint({
        selectedWeek: 0,
        kind: "stats",
        nfl: preNfl,
      }),
      { seasonType: "regular", week: 0 },
    );
  });

  it("uses the current regular-season week on global Rankings once NFL week 1 starts", () => {
    assert.deepEqual(
      resolvePlayerScorePoint({
        selectedWeek: 0,
        kind: "stats",
        nfl: {
          season: "2026",
          season_type: "regular",
          week: 3,
          display_week: 3,
        },
      }),
      { seasonType: "regular", week: 3 },
    );
  });

  it("maps league fantasy week 1 to ESPN Preseason Week 1", () => {
    assert.deepEqual(
      resolvePlayerScorePoint({
        selectedWeek: 1,
        kind: "stats",
        nfl: preNfl,
        schedule: withPre,
      }),
      { seasonType: "pre", week: 2 },
    );
  });

  it("maps league fantasy week 1 to NFL regular week 1 without preseason", () => {
    assert.deepEqual(
      resolvePlayerScorePoint({
        selectedWeek: 1,
        kind: "stats",
        nfl: preNfl,
        schedule: withoutPre,
      }),
      { seasonType: "regular", week: 1 },
    );
  });

  it("keeps prior-year stats on regular season totals", () => {
    assert.deepEqual(
      resolvePlayerScorePoint({
        selectedWeek: 0,
        kind: "stats",
        nfl: preNfl,
        schedule: withPre,
        seasonYear: 2025,
      }),
      { seasonType: "regular", week: 0 },
    );
  });
});

describe("playerTableWeekItems", () => {
  it("keeps Week 1–18 when preseason is off", () => {
    const items = playerTableWeekItems(withoutPre);
    assert.equal(items[0]?.value, "season");
    assert.equal(items[1]?.label, "Week 1");
    assert.equal(items[1]?.value, "1");
    assert.equal(items.length, 19);
  });

  it("prefixes counting preseason weeks for include-preseason leagues", () => {
    const items = playerTableWeekItems(withPre);
    assert.deepEqual(items.slice(0, 5), [
      { label: "Season", value: "season" },
      { label: "Preseason Week 1", value: "1" },
      { label: "Preseason Week 2", value: "2" },
      { label: "Preseason Week 3", value: "3" },
      { label: "Week 1", value: "4" },
    ]);
  });
});
