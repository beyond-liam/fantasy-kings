import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPowerRankTrajectory,
  pickTrendingTeams,
  summarizePowerRankTrajectory,
  trajectoryToChartData,
} from "@/lib/leagues/power-rankings/trajectory";
import type { PowerRankingTeamRow } from "@/lib/leagues/power-rankings/types";
import type {
  FinalMatchupRecord,
  LeagueStandingsMember,
} from "@/lib/leagues/standings";

function draftRow(
  partial: Pick<PowerRankingTeamRow, "teamId" | "rank" | "teamName">,
): PowerRankingTeamRow {
  return {
    rankDelta: null,
    teamPublicId: partial.teamId,
    ownerName: "Owner",
    ownerUserId: null,
    logoUrl: null,
    powerScore: 100,
    tone: "success",
    ...partial,
  };
}

function member(
  teamId: string,
  teamName: string,
): LeagueStandingsMember {
  return {
    teamId,
    teamName,
    teamPublicId: teamId,
    displayName: null,
    firstName: "A",
    lastName: "B",
    username: null,
    userId: `user-${teamId}`,
    draftSlot: null,
    teamCreatedAt: null,
    waiverPriority: null,
    faabRemaining: null,
    logoUrl: null,
    divisionId: null,
  };
}

describe("power rank trajectory", () => {
  const members = [
    member("a", "Alpha"),
    member("b", "Beta"),
    member("c", "Charlie"),
    member("d", "Delta"),
  ];

  const draftRows = [
    draftRow({ teamId: "a", rank: 1, teamName: "Alpha" }),
    draftRow({ teamId: "b", rank: 2, teamName: "Beta" }),
    draftRow({ teamId: "c", rank: 3, teamName: "Charlie" }),
    draftRow({ teamId: "d", rank: 4, teamName: "Delta" }),
  ];

  it("starts at draft and adds scored weeks", () => {
    const finals: FinalMatchupRecord[] = [
      {
        id: "1",
        week: 1,
        homeTeamId: "a",
        awayTeamId: "b",
        homePts: 100,
        awayPts: 90,
      },
      {
        id: "2",
        week: 1,
        homeTeamId: "c",
        awayTeamId: "d",
        homePts: 110,
        awayPts: 80,
      },
    ];

    const ticks = buildPowerRankTrajectory({
      draftRows,
      members,
      standingsOptions: { teamCount: 4 },
      finals,
    });

    assert.equal(ticks.length, 2);
    assert.equal(ticks[0]!.id, "draft");
    assert.equal(ticks[0]!.ranksByTeamId.a, 1);
    assert.equal(ticks[1]!.label, "Week 1");
    assert.ok(ticks[1]!.ranksByTeamId.a);
  });

  it("summarizes high/low and trend deltas", () => {
    const ticks = [
      {
        id: "draft",
        label: "Draft",
        week: null,
        ranksByTeamId: { a: 4, b: 1 },
      },
      {
        id: "week-1",
        label: "Week 1",
        week: 1,
        ranksByTeamId: { a: 1, b: 3 },
      },
    ];

    const summaries = summarizePowerRankTrajectory({
      ticks,
      teams: [
        {
          teamId: "a",
          teamPublicId: "a",
          teamName: "Alpha",
          ownerName: "Ann",
          logoUrl: null,
        },
        {
          teamId: "b",
          teamPublicId: "b",
          teamName: "Beta",
          ownerName: "Bob",
          logoUrl: null,
        },
      ],
    });

    const alpha = summaries.find((row) => row.teamId === "a")!;
    assert.equal(alpha.draftRank, 4);
    assert.equal(alpha.currentRank, 1);
    assert.equal(alpha.highestRank, 1);
    assert.equal(alpha.lowestRank, 4);
    assert.equal(alpha.rankDelta, 3);

    const up = pickTrendingTeams(summaries, "up");
    const down = pickTrendingTeams(summaries, "down");
    assert.equal(up[0]?.teamId, "a");
    assert.equal(down[0]?.teamId, "b");
  });

  it("maps ticks into chart rows", () => {
    const data = trajectoryToChartData(
      [
        {
          id: "draft",
          label: "Draft",
          week: null,
          ranksByTeamId: { a: 1, b: 2 },
        },
      ],
      ["a", "b"],
    );
    assert.deepEqual(data, [
      { label: "Draft", tickId: "draft", a: 1, b: 2 },
    ]);
  });
});
