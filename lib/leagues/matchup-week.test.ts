import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ScheduleWeek } from "@/lib/espn/scoreboard";
import { rangeLabelForNflWeek } from "@/lib/leagues/matchup-week";

function week(
  number: number,
  seasonType: ScheduleWeek["seasonType"],
  rangeLabel: string,
): ScheduleWeek {
  return {
    number,
    seasonType,
    label: `Week ${number}`,
    rangeLabel,
    startDate: new Date("2026-09-10T00:00:00Z"),
    endDate: new Date("2026-09-16T00:00:00Z"),
  };
}

describe("rangeLabelForNflWeek", () => {
  const calendar = [
    week(2, 1, "13 Aug - 19"),
    week(1, 2, "6 Sept - 15"),
    week(2, 2, "16 Sept - 22"),
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
