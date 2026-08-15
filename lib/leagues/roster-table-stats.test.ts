import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { accumulateRosterSeasonTotals } from "./roster-table-stats";

describe("accumulateRosterSeasonTotals", () => {
  it("sums appeared weeks and averages by games played", () => {
    const totals = accumulateRosterSeasonTotals(
      [
        {
          playerId: "a",
          week: 1,
          seasonType: "regular",
          appeared: true,
          fantasyPts: 10,
        },
        {
          playerId: "a",
          week: 2,
          seasonType: "regular",
          appeared: true,
          fantasyPts: 20,
        },
        {
          playerId: "a",
          week: 3,
          seasonType: "regular",
          appeared: false,
          fantasyPts: null,
        },
      ],
      { week: 3, seasonType: "regular" },
    );

    assert.deepEqual(totals.get("a"), { fantasyPts: 30, avgPts: 15 });
  });

  it("ignores weeks that have not occurred yet", () => {
    const totals = accumulateRosterSeasonTotals(
      [
        {
          playerId: "a",
          week: 1,
          seasonType: "regular",
          appeared: true,
          fantasyPts: 12,
        },
        {
          playerId: "a",
          week: 4,
          seasonType: "regular",
          appeared: true,
          fantasyPts: 40,
        },
      ],
      { week: 2, seasonType: "regular" },
    );

    assert.deepEqual(totals.get("a"), { fantasyPts: 12, avgPts: 12 });
  });

  it("counts a zero-point appearance toward AVG", () => {
    const totals = accumulateRosterSeasonTotals(
      [
        {
          playerId: "a",
          week: 1,
          seasonType: "regular",
          appeared: true,
          fantasyPts: 10,
        },
        {
          playerId: "a",
          week: 2,
          seasonType: "regular",
          appeared: true,
          fantasyPts: 0,
        },
      ],
      { week: 2, seasonType: "regular" },
    );

    assert.deepEqual(totals.get("a"), { fantasyPts: 10, avgPts: 5 });
  });
});
