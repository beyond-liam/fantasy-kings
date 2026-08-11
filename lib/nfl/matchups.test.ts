import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildOpponentByTeam,
  formatMatchupKickoff,
  resolvePlayerOpponent,
  type TeamMatchup,
} from "@/lib/nfl/matchups";
import type { ScheduleGame } from "@/lib/espn/scoreboard";

function side(abbreviation: string) {
  return {
    abbreviation,
    displayName: abbreviation,
    city: abbreviation,
    nickname: abbreviation,
    shortName: abbreviation,
    logoUrl: "",
    score: null as number | null,
    linescores: [] as number[],
    record: "",
    winner: null as boolean | null,
  };
}

function game(
  home: string,
  away: string,
  kickoff = "2026-10-18T17:00:00Z",
): ScheduleGame {
  return {
    id: `${away}-${home}`,
    kickoff,
    venue: "Stadium",
    venueLocation: null,
    status: "pre",
    statusText: "Scheduled",
    period: null,
    displayClock: null,
    network: null,
    odds: null,
    home: side(home),
    away: side(away),
  };
}

describe("resolvePlayerOpponent", () => {
  it("returns BYE when the team is absent from a loaded slate", () => {
    const opponentsByTeam = buildOpponentByTeam([game("LV", "BUF")]);
    const result = resolvePlayerOpponent({
      nflTeam: "CIN",
      byeWeek: null,
      week: 6,
      opponentsByTeam,
      seasonYear: 2026,
    });
    assert.equal(result?.label, "BYE");
  });

  it("returns null when the slate is empty and bye cannot be inferred", () => {
    const opponentsByTeam = new Map<string, TeamMatchup>();
    const result = resolvePlayerOpponent({
      nflTeam: "DET",
      byeWeek: null,
      week: 1,
      opponentsByTeam,
      seasonYear: 2026,
    });
    assert.equal(result, null);
  });

  it("returns BYE from the season map when byeWeek is null but week matches", () => {
    const result = resolvePlayerOpponent({
      nflTeam: "DET",
      byeWeek: null,
      week: 6,
      opponentsByTeam: new Map(),
      seasonYear: 2026,
    });
    assert.equal(result?.label, "BYE");
  });

  it("returns the matchup when the team is on the slate", () => {
    const opponentsByTeam = buildOpponentByTeam([game("LV", "BUF")]);
    const result = resolvePlayerOpponent({
      nflTeam: "BUF",
      byeWeek: null,
      week: 6,
      opponentsByTeam,
      seasonYear: 2026,
    });
    assert.equal(result?.label, "@ LV");
  });
});

describe("formatMatchupKickoff", () => {
  it("formats kickoff in UK time", () => {
    // 1:00pm EDT = 17:00 UTC = 6:00pm BST
    assert.equal(formatMatchupKickoff("2026-08-13T17:00:00Z"), "Thu 6pm");
  });
});
