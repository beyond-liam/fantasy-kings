import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveCurrentWeekForTeamRoster } from "@/lib/queries/team-roster";

describe("resolveCurrentWeekForTeamRoster", () => {
  it("returns explicit currentWeek without invoking resolver", async () => {
    let resolverCalls = 0;
    const currentWeek = await resolveCurrentWeekForTeamRoster({
      currentWeek: 7,
      seasonYear: 2026,
      regularSeasonEndWeek: 14,
      resolveWeek: async () => {
        resolverCalls += 1;
        return {
          currentWeek: 99,
          week: 99,
          weeks: [],
          calendarWeeks: [],
        };
      },
    });

    assert.equal(currentWeek, 7);
    assert.equal(resolverCalls, 0);
  });

  it("uses resolver when currentWeek is missing and season context exists", async () => {
    let resolverCalls = 0;
    const currentWeek = await resolveCurrentWeekForTeamRoster({
      seasonYear: 2026,
      regularSeasonEndWeek: 14,
      resolveWeek: async () => {
        resolverCalls += 1;
        return {
          currentWeek: 5,
          week: 5,
          weeks: [],
          calendarWeeks: [],
        };
      },
    });

    assert.equal(currentWeek, 5);
    assert.equal(resolverCalls, 1);
  });
});
