import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAllTimeTable,
  countLuckyWinsByTeam,
  pickMostRegularSeasonWins,
  pickWinningScoreExtremes,
} from "@/lib/leagues/hall-of-fame";

const teams = [
  {
    teamId: "a",
    teamPublicId: "a",
    teamName: "Alpha",
    ownerName: "A",
    logoUrl: null,
    claimed: true,
  },
  {
    teamId: "b",
    teamPublicId: "b",
    teamName: "Beta",
    ownerName: "B",
    logoUrl: null,
    claimed: true,
  },
];

describe("hall of fame helpers", () => {
  it("builds all-time table and RS wins leader", () => {
    const table = buildAllTimeTable(teams, [
      {
        id: "1",
        week: 1,
        homeTeamId: "a",
        awayTeamId: "b",
        homePts: 120,
        awayPts: 100,
      },
      {
        id: "2",
        week: 2,
        homeTeamId: "a",
        awayTeamId: "b",
        homePts: 90,
        awayPts: 110,
      },
      {
        id: "3",
        week: 3,
        homeTeamId: "b",
        awayTeamId: "a",
        homePts: 80,
        awayPts: 95,
      },
    ]);
    assert.equal(table[0]?.teamId, "a");
    assert.equal(table[0]?.wins, 2);
    assert.equal(pickMostRegularSeasonWins(table)?.teamId, "a");
    assert.equal(pickMostRegularSeasonWins(table)?.value, 2);
  });

  it("picks highest and lowest winning scores", () => {
    const { highest, lowest } = pickWinningScoreExtremes(teams, [
      {
        id: "1",
        week: 1,
        homeTeamId: "a",
        awayTeamId: "b",
        homePts: 150,
        awayPts: 100,
      },
      {
        id: "2",
        week: 2,
        homeTeamId: "b",
        awayTeamId: "a",
        homePts: 72,
        awayPts: 70,
      },
    ]);
    assert.equal(highest?.value, 150);
    assert.equal(highest?.teamId, "a");
    assert.equal(lowest?.value, 72);
    assert.equal(lowest?.teamId, "b");
  });

  it("counts lucky wins when opponent OPF would have won", () => {
    const counts = countLuckyWinsByTeam([
      {
        id: "1",
        week: 1,
        homeTeamId: "a",
        awayTeamId: "b",
        homePts: 110,
        awayPts: 100,
        homeOptimum: 110,
        awayOptimum: 130,
      },
    ]);
    assert.equal(counts.get("a"), 1);
    assert.equal(counts.get("b"), undefined);
  });
});
