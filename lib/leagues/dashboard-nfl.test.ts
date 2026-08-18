import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  pickStandardTeamOfTheWeek,
  pickStatLeader,
} from "@/lib/leagues/dashboard-nfl";

describe("dashboard NFL helpers", () => {
  it("picks the highest yardage leader", () => {
    const leader = pickStatLeader(
      [
        {
          id: "a",
          fullName: "Alpha",
          sleeperId: null,
          primaryPositionId: "QB",
          nflTeam: "KC",
          stats: { pass_yd: 250 },
        },
        {
          id: "b",
          fullName: "Beta",
          sleeperId: null,
          primaryPositionId: "QB",
          nflTeam: "BUF",
          stats: { pass_yd: 310 },
        },
      ],
      "pass_yd",
      (value) => `${value} yds`,
    );
    assert.equal(leader?.id, "b");
    assert.equal(leader?.line, "310 yds");
  });

  it("fills a standard team of the week including FLEX", () => {
    const rows = pickStandardTeamOfTheWeek([
      { id: "qb", fullName: "Q", sleeperId: null, primaryPositionId: "QB", nflTeam: "KC", points: 20 },
      { id: "rb1", fullName: "R1", sleeperId: null, primaryPositionId: "RB", nflTeam: "SF", points: 18 },
      { id: "rb2", fullName: "R2", sleeperId: null, primaryPositionId: "RB", nflTeam: "BAL", points: 16 },
      { id: "rb3", fullName: "R3", sleeperId: null, primaryPositionId: "RB", nflTeam: "DET", points: 14 },
      { id: "wr1", fullName: "W1", sleeperId: null, primaryPositionId: "WR", nflTeam: "MIA", points: 22 },
      { id: "wr2", fullName: "W2", sleeperId: null, primaryPositionId: "WR", nflTeam: "MIN", points: 15 },
      { id: "te", fullName: "T", sleeperId: null, primaryPositionId: "TE", nflTeam: "KC", points: 12 },
      { id: "k", fullName: "K", sleeperId: null, primaryPositionId: "K", nflTeam: "BAL", points: 9 },
      { id: "def", fullName: "D", sleeperId: null, primaryPositionId: "DEF", nflTeam: "DEN", points: 11 },
    ]);
    const flex = rows.find((row) => row.slot === "FLEX");
    assert.equal(flex?.player?.id, "rb3");
    assert.equal(rows.filter((row) => row.player).length, 9);
  });
});
