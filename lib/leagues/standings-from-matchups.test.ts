import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildLeagueStandings } from "@/lib/leagues/standings-from-matchups";
import type { LeagueStandingsMember } from "@/lib/leagues/standings";

const members: LeagueStandingsMember[] = [
  {
    teamId: "a",
    teamName: "Alpha",
    teamPublicId: "aaaaaa",
    displayName: "Ann",
    userId: "u1",
    draftSlot: 1,
    teamCreatedAt: new Date("2026-01-01"),
    waiverPriority: 1,
  },
  {
    teamId: "b",
    teamName: "Bravo",
    teamPublicId: "bbbbbb",
    displayName: "Bob",
    userId: "u2",
    draftSlot: 2,
    teamCreatedAt: new Date("2026-01-02"),
    waiverPriority: 2,
  },
];

describe("buildLeagueStandings", () => {
  it("keeps zeros with no finals", () => {
    const rows = buildLeagueStandings(members, { teamCount: 2 }, []);
    assert.equal(rows[0]?.wins, 0);
    assert.equal(rows[0]?.pointsFor, 0);
  });

  it("applies W/L/PF from final matchups and ranks by win pct then PF", () => {
    const rows = buildLeagueStandings(members, { teamCount: 2 }, [
      {
        id: "m1",
        week: 1,
        homeTeamId: "a",
        awayTeamId: "b",
        homePts: 120,
        awayPts: 100,
      },
      {
        id: "m2",
        week: 2,
        homeTeamId: "b",
        awayTeamId: "a",
        homePts: 110,
        awayPts: 90,
      },
    ]);

    assert.equal(rows[0]?.teamId, "a");
    assert.equal(rows[0]?.wins, 1);
    assert.equal(rows[0]?.losses, 1);
    assert.equal(rows[0]?.pointsFor, 210);
    assert.equal(rows[0]?.rank, 1);
    assert.equal(rows[1]?.teamId, "b");
    assert.equal(rows[1]?.pointsFor, 210);
  });

  it("counts ties within epsilon", () => {
    const rows = buildLeagueStandings(members, { teamCount: 2 }, [
      {
        id: "m1",
        week: 1,
        homeTeamId: "a",
        awayTeamId: "b",
        homePts: 100.02,
        awayPts: 100,
      },
    ]);
    assert.equal(rows[0]?.ties, 1);
    assert.equal(rows[1]?.ties, 1);
    assert.equal(rows[0]?.streak, "T1");
  });

  it("uses H2H rank tiebreaker when breakRegularSeasonTies is on", () => {
    const four: LeagueStandingsMember[] = [
      ...members,
      {
        teamId: "c",
        teamName: "Charlie",
        teamPublicId: "cccccc",
        displayName: "Cat",
        userId: "u3",
        draftSlot: 3,
        teamCreatedAt: new Date("2026-01-03"),
        waiverPriority: 3,
      },
      {
        teamId: "d",
        teamName: "Delta",
        teamPublicId: "dddddd",
        displayName: "Dan",
        userId: "u4",
        draftSlot: 4,
        teamCreatedAt: new Date("2026-01-04"),
        waiverPriority: 4,
      },
    ];

    // A and B both 2-1; B has more PF, but A owns the H2H win.
    const finals = [
      {
        id: "m1",
        week: 1,
        homeTeamId: "a",
        awayTeamId: "b",
        homePts: 120,
        awayPts: 100,
      },
      {
        id: "m2",
        week: 2,
        homeTeamId: "a",
        awayTeamId: "c",
        homePts: 90,
        awayPts: 100,
      },
      {
        id: "m3",
        week: 3,
        homeTeamId: "a",
        awayTeamId: "d",
        homePts: 110,
        awayPts: 80,
      },
      {
        id: "m4",
        week: 4,
        homeTeamId: "b",
        awayTeamId: "c",
        homePts: 110,
        awayPts: 80,
      },
      {
        id: "m5",
        week: 5,
        homeTeamId: "b",
        awayTeamId: "d",
        homePts: 130,
        awayPts: 90,
      },
    ];

    const byPf = buildLeagueStandings(four, { teamCount: 4 }, finals, {
      breakRegularSeasonTies: false,
      rankTiebreakers: [
        "head_to_head",
        "points_per_game",
        "schedule_record",
        "schedule_points",
      ],
    });
    assert.equal(byPf[0]?.teamId, "b", "without breakTies, higher PF wins");

    const byH2h = buildLeagueStandings(four, { teamCount: 4 }, finals, {
      breakRegularSeasonTies: true,
      rankTiebreakers: [
        "head_to_head",
        "points_per_game",
        "schedule_record",
        "schedule_points",
      ],
    });
    assert.equal(byH2h[0]?.teamId, "a", "with H2H first, A ranks above B");
    assert.equal(byH2h[1]?.teamId, "b");
  });
});
