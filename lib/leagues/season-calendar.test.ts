import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getFirstRoundByes,
  getPlayoffWeekCount,
  getPlayoffWeekRange,
  isFantasyLeaguePreseason,
  isNflSeasonUnderway,
  isScheduleEditable,
  listPlayoffWeeksFromCalendar,
  resolveLeagueSeasonMaxWeek,
} from "./season-calendar";

describe("playoff calendar helpers", () => {
  it("computes first-round byes for common formats", () => {
    assert.equal(getFirstRoundByes(4), 0);
    assert.equal(getFirstRoundByes(6), 2);
    assert.equal(getFirstRoundByes(8), 0);
  });

  it("extends playoff weeks for a two-week championship", () => {
    assert.equal(getPlayoffWeekCount(6), 3);
    assert.equal(
      getPlayoffWeekCount(6, { twoWeekChampionship: true }),
      4,
    );
    assert.deepEqual(getPlayoffWeekRange(17, 6), {
      startWeek: 15,
      endWeek: 17,
    });
    assert.deepEqual(
      getPlayoffWeekRange(17, 6, { twoWeekChampionship: true }),
      { startWeek: 14, endWeek: 17 },
    );
  });

  it("lists playoff weeks from regular-season end through championship", () => {
    assert.deepEqual(listPlayoffWeeksFromCalendar(15, 17), [16, 17]);
    assert.deepEqual(listPlayoffWeeksFromCalendar(14, 17), [15, 16, 17]);
    assert.deepEqual(listPlayoffWeeksFromCalendar(17, 17), []);
  });

  it("resolves league season max week from championship or playoffs", () => {
    assert.equal(
      resolveLeagueSeasonMaxWeek({ championshipWeek: 17 }),
      17,
    );
    assert.equal(
      resolveLeagueSeasonMaxWeek({
        regularSeasonEndWeek: 15,
        playoffWeeks: [16, 17],
      }),
      17,
    );
    assert.equal(
      resolveLeagueSeasonMaxWeek({
        regularSeasonEndWeek: 16,
        playoffWeeks: [17, 18],
      }),
      18,
    );
    assert.equal(resolveLeagueSeasonMaxWeek({}), 18);
  });

  it("treats offseason and preseason as not underway", () => {
    assert.equal(
      isNflSeasonUnderway(2026, {
        season: "2026",
        season_type: "off",
        week: 0,
      }),
      false,
    );
    assert.equal(
      isNflSeasonUnderway(2026, {
        season: "2026",
        season_type: "pre",
        week: 2,
      }),
      false,
    );
  });

  it("locks once regular season week 1 has started", () => {
    assert.equal(
      isNflSeasonUnderway(2026, {
        season: "2026",
        season_type: "regular",
        week: 1,
      }),
      true,
    );
    assert.equal(
      isFantasyLeaguePreseason(2026, {
        season: "2026",
        season_type: "regular",
        week: 1,
      }),
      false,
    );
    assert.equal(
      isScheduleEditable(2026, {
        season: "2026",
        season_type: "off",
        week: 0,
      }),
      true,
    );
  });

  it("treats NFL pre as fantasy preseason unless the league includes those weeks", () => {
    assert.equal(
      isFantasyLeaguePreseason(2026, {
        season: "2026",
        season_type: "pre",
        week: 2,
      }),
      true,
    );
    assert.equal(
      isFantasyLeaguePreseason(
        2026,
        { season: "2026", season_type: "pre", week: 2 },
        {
          playEachOtherTimes: 1,
          includePreseason: true,
          preseasonStartWeek: 1,
        },
      ),
      false,
    );
  });

  it("uses display_week when Sleeper week lags behind Preseason Week 1", () => {
    const schedule = {
      playEachOtherTimes: 1 as const,
      includePreseason: true,
      preseasonStartWeek: 1 as const,
    };
    // HOF still on `week`, but display is Preseason Week 1 (ESPN week 2).
    assert.equal(
      isNflSeasonUnderway(
        2026,
        { season: "2026", season_type: "pre", week: 1, display_week: 2 },
        schedule,
      ),
      true,
    );
    assert.equal(
      isFantasyLeaguePreseason(
        2026,
        { season: "2026", season_type: "pre", week: 1, display_week: 2 },
        schedule,
      ),
      false,
    );
    assert.equal(
      isFantasyLeaguePreseason(
        2026,
        { season: "2026", season_type: "pre", week: 1, display_week: 1 },
        schedule,
      ),
      true,
    );
  });
});
