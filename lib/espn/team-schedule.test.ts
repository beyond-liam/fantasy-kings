import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseEspnTeamScheduleEvents } from "@/lib/espn/team-schedule";

const houVsLacPre = {
  week: { number: 2 },
  seasonType: { type: 1 },
  competitions: [
    {
      status: { type: { completed: true, state: "post" } },
      competitors: [
        {
          homeAway: "home",
          score: "7",
          winner: false,
          team: { abbreviation: "HOU" },
        },
        {
          homeAway: "away",
          score: "27",
          winner: true,
          team: { abbreviation: "LAC" },
        },
      ],
    },
  ],
};

const houWeek1Regular = {
  week: { number: 1 },
  seasonType: { type: 2 },
  competitions: [
    {
      competitors: [
        {
          homeAway: "away",
          team: { abbreviation: "HOU" },
        },
        {
          homeAway: "home",
          team: { abbreviation: "BAL" },
        },
      ],
    },
  ],
};

describe("parseEspnTeamScheduleEvents", () => {
  it("keeps preseason games and skips Hall of Fame plus regular season", () => {
    const byWeek = parseEspnTeamScheduleEvents(
      [
        { ...houVsLacPre, week: { number: 1 } },
        houVsLacPre,
        houWeek1Regular,
      ],
      "HOU",
      "pre",
    );

    assert.equal(byWeek.size, 1);
    const week2 = byWeek.get(2);
    assert.ok(week2);
    assert.equal(week2.opponent, "vs LAC");
    assert.equal(week2.result, "L");
  });

  it("keeps regular-season games and skips preseason", () => {
    const byWeek = parseEspnTeamScheduleEvents(
      [houVsLacPre, houWeek1Regular],
      "HOU",
      "regular",
    );

    assert.equal(byWeek.size, 1);
    const week1 = byWeek.get(1);
    assert.ok(week1);
    assert.equal(week1.opponent, "@ BAL");
    assert.equal(week1.result, null);
  });
});
