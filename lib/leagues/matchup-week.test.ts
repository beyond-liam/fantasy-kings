import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ScheduleWeek } from "@/lib/espn/scoreboard";
import { rangeLabelForNflWeek, fantasyWeekFromCalendarWeeks } from "@/lib/leagues/matchup-week";

function week(
  number: number,
  seasonType: ScheduleWeek["seasonType"],
  rangeLabel: string,
  startDate: string,
  endDate: string,
): ScheduleWeek {
  return {
    number,
    seasonType,
    label: `Week ${number}`,
    rangeLabel,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  };
}

describe("rangeLabelForNflWeek", () => {
  const calendar = [
    week(2, 1, "13 Aug - 19", "2026-08-13T00:00:00Z", "2026-08-20T00:00:00Z"),
    week(1, 2, "6 Sept - 15", "2026-09-06T00:00:00Z", "2026-09-16T00:00:00Z"),
    week(2, 2, "16 Sept - 22", "2026-09-16T00:00:00Z", "2026-09-23T00:00:00Z"),
  ];

  it("uses the ESPN date range for the mapped NFL week", () => {
    assert.equal(
      rangeLabelForNflWeek(calendar, { seasonType: "regular", week: 1 }),
      "6 Sept - 15",
    );
    assert.equal(
      rangeLabelForNflWeek(calendar, { seasonType: "regular", week: 2 }),
      "16 Sept - 22",
    );
  });

  it("matches preseason by ESPN season type", () => {
    assert.equal(
      rangeLabelForNflWeek(calendar, { seasonType: "pre", week: 2 }),
      "13 Aug - 19",
    );
  });

  it("returns empty when the calendar has no window", () => {
    assert.equal(
      rangeLabelForNflWeek(calendar, { seasonType: "regular", week: 18 }),
      "",
    );
    assert.equal(rangeLabelForNflWeek(calendar, null), "");
  });
});

describe("fantasyWeekFromCalendarWeeks", () => {
  const withPre = {
    playEachOtherTimes: 1 as const,
    includePreseason: true,
    preseasonStartWeek: 1,
  };

  const preseasonCalendar = [
    // Fantasy week rolls match waivers’ Wed 00:01 UTC boundary.
    week(2, 1, "6 Aug - 12", "2026-08-12T00:01:00Z", "2026-08-19T00:01:00Z"),
    week(3, 1, "13 Aug - 19", "2026-08-19T00:01:00Z", "2026-08-26T00:01:00Z"),
    week(4, 1, "20 Aug - 26", "2026-08-26T00:01:00Z", "2026-09-02T00:01:00Z"),
    week(1, 2, "3 Sept - 9", "2026-09-02T00:01:00Z", "2026-09-09T00:01:00Z"),
  ];

  it("advances to fantasy week 2 when the ESPN preseason week 3 window starts", () => {
    assert.equal(
      fantasyWeekFromCalendarWeeks(
        preseasonCalendar,
        withPre,
        new Date("2026-08-19T11:00:00Z"),
      ),
      2,
    );
  });

  it("stays on fantasy week 1 during the first preseason window", () => {
    assert.equal(
      fantasyWeekFromCalendarWeeks(
        preseasonCalendar,
        withPre,
        new Date("2026-08-15T12:00:00Z"),
      ),
      1,
    );
  });

  it("ignores HOF and out-of-range preseason weeks", () => {
    const calendar = [
      week(1, 1, "HOF", "2026-08-05T00:01:00Z", "2026-08-12T00:01:00Z"),
      ...preseasonCalendar,
    ];
    assert.equal(
      fantasyWeekFromCalendarWeeks(
        calendar,
        withPre,
        new Date("2026-08-15T12:00:00Z"),
      ),
      1,
    );
  });
});
