import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countDivisionTitlesByTeam,
  pickDivisionWinnersForSeason,
} from "@/lib/leagues/hall-of-fame";
import {
  buildChampionshipSeasonRow,
  buildRegularSeasonTitleRow,
  runnerUpTeamIdFromBracket,
} from "@/lib/leagues/hof-title-history";
import type { PlayoffBracket } from "@/lib/leagues/playoff-bracket";

const teams = [
  {
    teamId: "a",
    teamPublicId: "a",
    teamName: "Alpha",
    ownerName: "A",
    logoUrl: null,
    claimed: true,
    divisionId: "east",
  },
  {
    teamId: "b",
    teamPublicId: "b",
    teamName: "Beta",
    ownerName: "B",
    logoUrl: null,
    claimed: true,
    divisionId: "east",
  },
  {
    teamId: "c",
    teamPublicId: "c",
    teamName: "Charlie",
    ownerName: "C",
    logoUrl: null,
    claimed: true,
    divisionId: "west",
  },
];

describe("hof title history", () => {
  it("builds championship season with runner-up", () => {
    const row = buildChampionshipSeasonRow({
      seasonYear: 2026,
      teams,
      championTeamId: "a",
      runnerUpTeamId: "b",
    });
    assert.equal(row.champion?.teamId, "a");
    assert.equal(row.runnerUp?.teamId, "b");
  });

  it("builds regular season title from all-time #1", () => {
    const row = buildRegularSeasonTitleRow({
      seasonYear: 2026,
      allTimeTable: [
        {
          teamId: "a",
          teamPublicId: "a",
          teamName: "Alpha",
          ownerName: "A",
          logoUrl: null,
          wins: 10,
          losses: 4,
          ties: 0,
          winPct: 10 / 14,
          pointsFor: 1400,
          pointsAgainst: 1200,
        },
      ],
    });
    assert.equal(row?.team.teamId, "a");
    assert.equal(row?.wins, 10);
  });

  it("picks a winner per division and counts titles", () => {
    const winners = pickDivisionWinnersForSeason({
      seasonYear: 2026,
      divisions: [
        { id: "east", name: "East", sortOrder: 0 },
        { id: "west", name: "West", sortOrder: 1 },
      ],
      allTimeTable: [
        {
          teamId: "a",
          teamPublicId: "a",
          teamName: "Alpha",
          ownerName: "A",
          logoUrl: null,
          wins: 11,
          losses: 3,
          ties: 0,
          winPct: 11 / 14,
          pointsFor: 1500,
          pointsAgainst: 1100,
        },
        {
          teamId: "c",
          teamPublicId: "c",
          teamName: "Charlie",
          ownerName: "C",
          logoUrl: null,
          wins: 9,
          losses: 5,
          ties: 0,
          winPct: 9 / 14,
          pointsFor: 1400,
          pointsAgainst: 1200,
        },
        {
          teamId: "b",
          teamPublicId: "b",
          teamName: "Beta",
          ownerName: "B",
          logoUrl: null,
          wins: 8,
          losses: 6,
          ties: 0,
          winPct: 8 / 14,
          pointsFor: 1300,
          pointsAgainst: 1250,
        },
      ],
      teams,
    });
    assert.equal(winners.length, 2);
    assert.equal(winners[0]?.divisionId, "east");
    assert.equal(winners[0]?.teamId, "a");
    assert.equal(winners[1]?.divisionId, "west");
    assert.equal(winners[1]?.teamId, "c");
    assert.equal(countDivisionTitlesByTeam(winners).get("a"), 1);
    assert.equal(countDivisionTitlesByTeam(winners).get("c"), 1);
  });

  it("reads runner-up from championship bracket slots", () => {
    const bracket = {
      champion: {
        teamId: "a",
        teamPublicId: "a",
        teamName: "Alpha",
        logoUrl: null,
        seed: 1,
        seriesPts: 100,
      },
      rounds: [
        {
          id: "championship",
          name: "Championship",
          weekLabel: "Week 17",
          matchups: [
            {
              id: "c1",
              top: {
                type: "team",
                team: {
                  seed: 1,
                  teamId: "a",
                  teamPublicId: "a",
                  teamName: "Alpha",
                  logoUrl: null,
                },
              },
              bottom: {
                type: "team",
                team: {
                  seed: 2,
                  teamId: "b",
                  teamPublicId: "b",
                  teamName: "Beta",
                  logoUrl: null,
                },
              },
            },
          ],
        },
      ],
      playoffTeamCount: 4,
      firstRoundByes: 0,
      championshipWeekLabel: "Week 17",
    } satisfies PlayoffBracket;

    assert.equal(runnerUpTeamIdFromBracket(bracket), "b");
  });
});
