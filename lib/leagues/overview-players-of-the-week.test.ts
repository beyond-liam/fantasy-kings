import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pickPlayersOfTheWeek, playersFromSeasonWeekTotals } from "@/lib/leagues/overview-players-of-the-week";

describe("pickPlayersOfTheWeek", () => {
  it("picks best QB / RB / WR|TE by full fantasy points", () => {
    const result = pickPlayersOfTheWeek([
      {
        id: "qb1",
        fullName: "A Passer",
        sleeperId: "1",
        primaryPositionId: "QB",
        nflTeam: "BUF",
        fantasyPts: 22.4,
      },
      {
        id: "qb2",
        fullName: "B Passer",
        sleeperId: "2",
        primaryPositionId: "QB",
        nflTeam: "KC",
        fantasyPts: 28.1,
      },
      {
        id: "rb1",
        fullName: "A Rusher",
        sleeperId: "3",
        primaryPositionId: "RB",
        nflTeam: "PHI",
        fantasyPts: 24.0,
      },
      {
        id: "wr1",
        fullName: "A Receiver",
        sleeperId: "4",
        primaryPositionId: "WR",
        nflTeam: "CIN",
        fantasyPts: 19.5,
      },
      {
        id: "te1",
        fullName: "B Tight End",
        sleeperId: "5",
        primaryPositionId: "TE",
        nflTeam: "KC",
        fantasyPts: 21.2,
      },
    ]);

    assert.equal(result.passer?.id, "qb2");
    assert.equal(result.passer?.points, 28.1);
    assert.equal(result.rusher?.id, "rb1");
    assert.equal(result.rusher?.points, 24.0);
    assert.equal(result.receiver?.id, "te1");
    assert.equal(result.receiver?.points, 21.2);
  });

  it("sums weekly scores for season-to-date highlights", () => {
    const players = playersFromSeasonWeekTotals(
      [
        {
          id: "qb1",
          fullName: "A Passer",
          sleeperId: "1",
          primaryPositionId: "QB",
          nflTeam: "PIT",
          week: 2,
          seasonType: "pre",
          fantasyPts: 21.9,
        },
        {
          id: "qb1",
          fullName: "A Passer",
          sleeperId: "1",
          primaryPositionId: "QB",
          nflTeam: "PIT",
          week: 3,
          seasonType: "pre",
          fantasyPts: 10.1,
        },
        {
          id: "qb2",
          fullName: "Later",
          sleeperId: "2",
          primaryPositionId: "QB",
          nflTeam: "KC",
          week: 1,
          seasonType: "regular",
          fantasyPts: 99,
        },
      ],
      { week: 3, seasonType: "pre" },
    );
    const result = pickPlayersOfTheWeek(players);
    assert.equal(result.passer?.id, "qb1");
    assert.equal(result.passer?.points, 32);
  });
});
