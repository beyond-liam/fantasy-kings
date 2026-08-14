import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolvePlayerScorePoint } from "@/lib/leagues/schedule/player-score-point";
import {
  countingGamesHaveStarted,
  resolveTablePositionRanks,
} from "@/lib/rankings/table-rank-source";

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

const week0 = { week: 0, seasonType: "regular" as const };
const week2Regular = { week: 2, seasonType: "regular" as const };

describe("resolveTablePositionRanks", () => {
  it("always uses projected rank on the Projection tab", () => {
    assert.deepEqual(
      resolveTablePositionRanks({
        kind: "projection",
        scorePoint: week0,
        statsPoint: week2Regular,
      }),
      { kind: "projection", week: 0, seasonType: "regular" },
    );
    assert.deepEqual(
      resolveTablePositionRanks({
        kind: "projection",
        scorePoint: { week: 3, seasonType: "regular" },
        statsPoint: week2Regular,
      }),
      { kind: "projection", week: 3, seasonType: "regular" },
    );
  });

  it("uses projected ranks on Stats before any counting NFL week", () => {
    assert.deepEqual(
      resolveTablePositionRanks({
        kind: "stats",
        scorePoint: week0,
        statsPoint: week0,
      }),
      { kind: "projection", week: 0, seasonType: "regular" },
    );
  });

  it("uses that week's actual ranks once the selected stats week has been played", () => {
    assert.deepEqual(
      resolveTablePositionRanks({
        kind: "stats",
        scorePoint: { week: 2, seasonType: "pre" },
        statsPoint: { week: 2, seasonType: "pre" },
      }),
      { kind: "stats", week: 2, seasonType: "pre" },
    );
    assert.deepEqual(
      resolveTablePositionRanks({
        kind: "stats",
        scorePoint: { week: 1, seasonType: "regular" },
        statsPoint: week2Regular,
      }),
      { kind: "stats", week: 1, seasonType: "regular" },
    );
  });

  it("uses season actual ranks for stats weeks that have not been played yet", () => {
    assert.deepEqual(
      resolveTablePositionRanks({
        kind: "stats",
        scorePoint: { week: 10, seasonType: "regular" },
        statsPoint: week2Regular,
      }),
      { kind: "stats", week: 2, seasonType: "regular" },
    );
  });

  it("uses prior-year week actuals even when season totals live on week 0", () => {
    assert.deepEqual(
      resolveTablePositionRanks({
        kind: "stats",
        scorePoint: { week: 8, seasonType: "regular" },
        statsPoint: week0,
        isCurrentSeason: false,
      }),
      { kind: "stats", week: 8, seasonType: "regular" },
    );
  });

  it("switches an include-preseason league to actuals during Hall of Fame lag", () => {
    const statsPoint = resolvePlayerScorePoint({
      selectedWeek: 0,
      kind: "stats",
      nfl: {
        season: "2026",
        season_type: "pre",
        week: 1,
        display_week: 1,
      },
      schedule: withPre,
    });
    assert.equal(countingGamesHaveStarted(statsPoint), true);
    assert.deepEqual(
      resolveTablePositionRanks({
        kind: "stats",
        scorePoint: statsPoint,
        statsPoint,
      }),
      {
        kind: "stats",
        week: 2,
        seasonType: "pre",
      },
    );
  });

  it("keeps projected ranks when the league excludes preseason", () => {
    const statsPoint = resolvePlayerScorePoint({
      selectedWeek: 0,
      kind: "stats",
      nfl: {
        season: "2026",
        season_type: "pre",
        week: 2,
        display_week: 2,
      },
      schedule: withoutPre,
    });
    assert.equal(countingGamesHaveStarted(statsPoint), false);
    assert.deepEqual(
      resolveTablePositionRanks({
        kind: "stats",
        scorePoint: statsPoint,
        statsPoint,
      }),
      {
        kind: "projection",
        week: 0,
        seasonType: "regular",
      },
    );
  });

  it("keeps projected ranks on global Rankings during NFL preseason", () => {
    const statsPoint = resolvePlayerScorePoint({
      selectedWeek: 0,
      kind: "stats",
      nfl: {
        season: "2026",
        season_type: "pre",
        week: 2,
        display_week: 2,
      },
    });
    assert.equal(countingGamesHaveStarted(statsPoint), false);
    assert.deepEqual(
      resolveTablePositionRanks({
        kind: "stats",
        scorePoint: statsPoint,
        statsPoint,
      }),
      {
        kind: "projection",
        week: 0,
        seasonType: "regular",
      },
    );
  });
});
