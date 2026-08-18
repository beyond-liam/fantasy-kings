import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildOpponentByTeam,
  formatMatchupKickoff,
  resolvePlayerOpponent,
  withPositionalSos,
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
    possession: null,
    situation: null,
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
    assert.equal(result?.abbrev, "LV");
    assert.equal(result?.gameId, "BUF-LV");
    assert.equal(result?.hasPossession, false);
    assert.equal(result?.inRedZone, false);
  });

  it("marks possession and red zone from the live slate", () => {
    const live = game("BUF", "CAR");
    live.status = "in";
    live.possession = "away";
    live.situation = {
      downDistance: "1st & Goal • BUF 6",
      homeTimeouts: 2,
      awayTimeouts: 3,
      isRedZone: true,
    };
    live.away.score = 7;
    live.home.score = 13;
    live.period = 2;
    live.displayClock = "0:13";
    live.statusText = "Q2 0:13";
    const result = resolvePlayerOpponent({
      nflTeam: "CAR",
      byeWeek: null,
      week: 1,
      opponentsByTeam: buildOpponentByTeam([live]),
      seasonYear: 2026,
    });
    assert.equal(result?.hasPossession, true);
    assert.equal(result?.inRedZone, true);
    assert.equal(result?.kickoffLabel, "1st & Goal · Q2 0:13");

    const defending = resolvePlayerOpponent({
      nflTeam: "BUF",
      byeWeek: null,
      week: 1,
      opponentsByTeam: buildOpponentByTeam([live]),
      seasonYear: 2026,
    });
    assert.equal(defending?.hasPossession, false);
    assert.equal(defending?.inRedZone, true);
  });
});

describe("formatMatchupKickoff", () => {
  it("formats kickoff in UK time", () => {
    // 1:00pm EDT = 17:00 UTC = 6:00pm BST
    assert.equal(formatMatchupKickoff("2026-08-13T17:00:00Z"), "Thu 6pm");
  });
});

describe("withPositionalSos", () => {
  it("stamps Easy/Average/Hard onto the opponent when ranked", () => {
    const opponentsByTeam = buildOpponentByTeam([game("LV", "BUF")]);
    const opponent = resolvePlayerOpponent({
      nflTeam: "BUF",
      byeWeek: null,
      week: 6,
      opponentsByTeam,
      seasonYear: 2026,
    });
    const stamped = withPositionalSos(
      opponent,
      "QB",
      new Map([
        [
          "QB",
          new Map([
            [
              "LV",
              {
                positionId: "QB",
                rank: 31,
                ptsAllowed: 23.2,
                difficulty: "easy",
                teamCount: 32,
              },
            ],
          ]),
        ],
      ]),
    );
    assert.equal(stamped?.matchup?.rank, 31);
    assert.equal(stamped?.matchup?.difficulty, "easy");
  });

  it("leaves BYE and unknown opponents unchanged", () => {
    const bye = resolvePlayerOpponent({
      nflTeam: "DET",
      byeWeek: 6,
      week: 6,
      opponentsByTeam: new Map(),
      seasonYear: 2026,
    });
    const stamped = withPositionalSos(
      bye,
      "QB",
      new Map([["QB", new Map()]]),
    );
    assert.equal(stamped?.label, "BYE");
    assert.equal(stamped?.matchup, undefined);
  });
});
