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
});
