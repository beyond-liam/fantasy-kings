import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bracketTeamsFromStandings,
  buildPlayoffBracket,
} from "@/lib/leagues/playoff-bracket";

function teams(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    seed: index + 1,
    teamId: `t${index + 1}`,
    teamPublicId: `p${index + 1}`,
    teamName: `Team ${index + 1}`,
    logoUrl: null,
  }));
}

describe("buildPlayoffBracket", () => {
  it("returns null when playoffs disabled", () => {
    assert.equal(
      buildPlayoffBracket({
        teams: teams(4),
        playoffTeamCount: 4,
        championshipWeek: 17,
        enabled: false,
      }),
      null,
    );
  });

  it("builds a 4-team bracket: semis then championship", () => {
    const bracket = buildPlayoffBracket({
      teams: teams(4),
      playoffTeamCount: 4,
      championshipWeek: 17,
    });
    assert.ok(bracket);
    assert.equal(bracket.rounds.length, 2);
    assert.equal(bracket.rounds[0]?.name, "Semifinals");
    assert.equal(bracket.rounds[0]?.matchups.length, 2);
    assert.equal(bracket.rounds[1]?.name, "Championship");
    const sf1 = bracket.rounds[0]!.matchups[0]!;
    assert.equal(sf1.top.type, "team");
    assert.equal(sf1.top.type === "team" ? sf1.top.team.seed : null, 1);
    assert.equal(sf1.bottom.type === "team" ? sf1.bottom.team.seed : null, 4);
  });

  it("builds a 6-team bracket with byes into semis", () => {
    const bracket = buildPlayoffBracket({
      teams: teams(6),
      playoffTeamCount: 6,
      championshipWeek: 17,
    });
    assert.ok(bracket);
    assert.equal(bracket.firstRoundByes, 2);
    assert.equal(bracket.rounds[0]?.matchups.length, 2);
    assert.equal(bracket.rounds[1]?.name, "Semifinals");
    const sf1 = bracket.rounds[1]!.matchups[0]!;
    assert.equal(sf1.top.type, "bye");
    assert.equal(sf1.top.type === "bye" ? sf1.top.team.seed : null, 1);
    assert.equal(sf1.bottom.type, "tbd");
  });

  it("builds an 8-team bracket with four quarterfinals", () => {
    const bracket = buildPlayoffBracket({
      teams: teams(8),
      playoffTeamCount: 8,
      championshipWeek: 17,
    });
    assert.ok(bracket);
    assert.equal(bracket.rounds[0]?.matchups.length, 4);
    assert.equal(bracket.rounds.length, 3);
  });

  it("adds a second championship round when enabled", () => {
    const bracket = buildPlayoffBracket({
      teams: teams(4),
      playoffTeamCount: 4,
      championshipWeek: 17,
      twoWeekChampionship: true,
    });
    assert.ok(bracket);
    assert.equal(bracket.rounds.length, 3);
    assert.equal(bracket.rounds[1]?.name, "Championship · Game 1");
    assert.equal(bracket.rounds[2]?.name, "Championship · Game 2");
  });
});

describe("bracketTeamsFromStandings", () => {
  it("keeps only playoff seeds", () => {
    const teamsList = bracketTeamsFromStandings(
      [
        {
          seed: 1,
          teamId: "a",
          teamPublicId: "a",
          teamName: "Alpha",
          logoUrl: null,
          claimed: true,
        },
        {
          seed: 7,
          teamId: "b",
          teamPublicId: "b",
          teamName: "Beta",
          logoUrl: null,
          claimed: true,
        },
      ],
      6,
    );
    assert.equal(teamsList.length, 1);
    assert.equal(teamsList[0]?.seed, 1);
  });
});
