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
    week(2, 1, "13 Aug - 19", "2026-08-13T07:00:00Z", "2026-08-20T06:59:00Z"),
    week(1, 2, "6 Sept - 15", "2026-09-06T07:00:00Z", "2026-09-16T06:59:00Z"),
    week(2, 2, "16 Sept - 22", "2026-09-16T07:00:00Z", "2026-09-23T06:59:00Z"),
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

  // Realistic ESPN preseason windows (Thu 07:00 → next Wed 06:59 UTC)
  const preseasonCalendar = [
    week(2, 1, "Pre Wk 1", "2026-08-13T07:00:00Z", "2026-08-20T06:59:00Z"),
    week(3, 1, "Pre Wk 2", "2026-08-20T07:00:00Z", "2026-08-27T06:59:00Z"),
    week(4, 1, "Pre Wk 3", "2026-08-27T07:00:00Z", "2026-09-06T06:59:00Z"),
    week(1, 2, "RS Wk 1",  "2026-09-06T07:00:00Z", "2026-09-16T06:59:00Z"),
  ];

  it("shows fantasy week 1 on Thursday when the ESPN window starts", () => {
    // Thu Aug 13 at noon — ESPN Pre Wk1 just started, Wed boundary is Aug 12
    // which is before the window start → no advance → fantasy week 1.
    assert.equal(
      fantasyWeekFromCalendarWeeks(
        preseasonCalendar,
        withPre,
        new Date("2026-08-13T12:00:00Z"),
      ),
      1,
    );
  });

  it("advances to fantasy week 2 after Wednesday 00:01 UTC within ESPN Pre Wk1", () => {
    // Wed Aug 19 at 11:00 — still inside ESPN Pre Wk1 window (ends Aug 20),
    // but Wed 00:01 boundary (Aug 19) > ESPN window start (Aug 13) → advance.
    assert.equal(
      fantasyWeekFromCalendarWeeks(
        preseasonCalendar,
        withPre,
        new Date("2026-08-19T11:00:00Z"),
      ),
      2,
    );
  });

  it("stays on fantasy week 1 on Tuesday before the Wednesday rollover", () => {
    // Tue Aug 18 at 23:00 — Wed boundary is Aug 12 (previous week) which is
    // before ESPN window start Aug 13 → no advance → fantasy week 1.
    assert.equal(
      fantasyWeekFromCalendarWeeks(
        preseasonCalendar,
        withPre,
        new Date("2026-08-18T23:00:00Z"),
      ),
      1,
    );
  });

  it("advances to fantasy week 3 after second Wednesday rollover", () => {
    // Wed Aug 26 — inside ESPN Pre Wk2 (Aug 20–27), Wed boundary is Aug 26
    // which is after window start Aug 20 → advance to Pre Wk3 = fantasy week 3.
    assert.equal(
      fantasyWeekFromCalendarWeeks(
        preseasonCalendar,
        withPre,
        new Date("2026-08-26T10:00:00Z"),
      ),
      3,
    );
  });

  it("ignores HOF and out-of-range preseason weeks", () => {
    const calendar = [
      week(1, 1, "HOF", "2026-08-06T07:00:00Z", "2026-08-13T06:59:00Z"),
      ...preseasonCalendar,
    ];
    // Thu Aug 13 — HOF filtered out, first eligible is Pre Wk1, no advance.
    assert.equal(
      fantasyWeekFromCalendarWeeks(
        calendar,
        withPre,
        new Date("2026-08-13T12:00:00Z"),
      ),
      1,
    );
  });
});
