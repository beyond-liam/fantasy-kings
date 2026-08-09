import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calendarSeasonTypesForSchedule,
  DEFAULT_SCHEDULE_SETTINGS,
  filterScheduleWeeks,
} from "@/lib/account/schedule-settings";

describe("schedule settings", () => {
  it("requests regular only when preseason is off", () => {
    assert.deepEqual(
      calendarSeasonTypesForSchedule({
        includePreseason: false,
        preseasonStartWeek: 1,
      }),
      [2],
    );
  });

  it("requests preseason and regular when preseason is on", () => {
    assert.deepEqual(
      calendarSeasonTypesForSchedule({
        includePreseason: true,
        preseasonStartWeek: 1,
      }),
      [1, 2],
    );
  });

  it("defaults to regular only", () => {
    assert.deepEqual(
      calendarSeasonTypesForSchedule(DEFAULT_SCHEDULE_SETTINGS),
      [2],
    );
  });

  it("filters preseason weeks before the start week (and always drops HOF)", () => {
    const weeks = [
      { number: 1, seasonType: 1 as const },
      { number: 2, seasonType: 1 as const },
      { number: 3, seasonType: 1 as const },
      { number: 4, seasonType: 1 as const },
      { number: 1, seasonType: 2 as const },
    ];

    assert.deepEqual(
      filterScheduleWeeks(weeks, {
        includePreseason: true,
        preseasonStartWeek: 1,
      }),
      [
        { number: 2, seasonType: 1 },
        { number: 3, seasonType: 1 },
        { number: 4, seasonType: 1 },
        { number: 1, seasonType: 2 },
      ],
    );

    assert.deepEqual(
      filterScheduleWeeks(weeks, {
        includePreseason: true,
        preseasonStartWeek: 3,
      }),
      [
        { number: 4, seasonType: 1 },
        { number: 1, seasonType: 2 },
      ],
    );
  });

  it("drops all preseason weeks when disabled", () => {
    const weeks = [
      { number: 4, seasonType: 1 as const },
      { number: 1, seasonType: 2 as const },
    ];

    assert.deepEqual(
      filterScheduleWeeks(weeks, {
        includePreseason: false,
        preseasonStartWeek: 1,
      }),
      [{ number: 1, seasonType: 2 }],
    );
  });
});
