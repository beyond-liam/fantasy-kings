import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  groupRosterPlayersForStats,
  overlayTeamPlayerStatRows,
  resolveTeamPlayerStatsSource,
} from "@/lib/leagues/team-stats";
import type { RankedPlayerRow } from "@/lib/queries/players";

function player(
  overrides: Partial<RankedPlayerRow> &
    Pick<RankedPlayerRow, "id" | "fullName" | "primaryPositionId">,
): RankedPlayerRow {
  return {
    sleeperId: null,
    nflTeam: null,
    byeWeek: null,
    injuryStatus: null,
    yearsExp: null,
    rookieYear: null,
    fantasyPts: 0,
    positionRank: null,
    ptsPpr: null,
    ptsStd: null,
    stats: {},
    opponent: null,
    ...overrides,
  };
}

describe("groupRosterPlayersForStats", () => {
  it("groups IDP into DB / DL / LB tables and omits empty DEF", () => {
    const sections = groupRosterPlayersForStats([
      player({ id: "1", fullName: "QB", primaryPositionId: "QB", fantasyPts: 20 }),
      player({ id: "2", fullName: "CB", primaryPositionId: "CB", fantasyPts: 10 }),
      player({ id: "3", fullName: "S", primaryPositionId: "S", fantasyPts: 12 }),
      player({ id: "4", fullName: "DT", primaryPositionId: "DT", fantasyPts: 8 }),
      player({ id: "5", fullName: "DE", primaryPositionId: "DE", fantasyPts: 9 }),
      player({ id: "6", fullName: "LB", primaryPositionId: "LB", fantasyPts: 14 }),
    ]);

    assert.deepEqual(
      sections.map((section) => section.id),
      [
        "quarterbacks",
        "running-backs",
        "receivers",
        "kickers",
        "defensive-backs",
        "defensive-linemen",
        "linebackers",
      ],
    );

    const backs = sections.find((s) => s.id === "defensive-backs");
    assert.deepEqual(
      backs?.players.map((p) => p.fullName),
      ["S", "CB"],
    );
    assert.equal(backs?.columnPosition, "CB");

    const line = sections.find((s) => s.id === "defensive-linemen");
    assert.deepEqual(
      line?.players.map((p) => p.fullName),
      ["DE", "DT"],
    );

    assert.equal(
      sections.find((s) => s.id === "linebackers")?.players[0]?.fullName,
      "LB",
    );
    assert.equal(
      sections.some((s) => s.id === "defense"),
      false,
    );
  });

  it("keeps Team Defense only when a DEF player is present", () => {
    const sections = groupRosterPlayersForStats([
      player({ id: "d", fullName: "Ravens", primaryPositionId: "DEF" }),
    ]);

    assert.equal(sections.at(-1)?.id, "defense");
    assert.equal(sections.at(-1)?.players[0]?.fullName, "Ravens");
  });

  it("orders each section by points scored", () => {
    const sections = groupRosterPlayersForStats([
      player({
        id: "low",
        fullName: "Low",
        primaryPositionId: "RB",
        fantasyPts: 4,
      }),
      player({
        id: "high",
        fullName: "High",
        primaryPositionId: "RB",
        fantasyPts: 18,
      }),
      player({
        id: "mid",
        fullName: "Mid",
        primaryPositionId: "RB",
        fantasyPts: 11,
      }),
    ]);

    assert.deepEqual(
      sections
        .find((s) => s.id === "running-backs")
        ?.players.map((p) => p.fullName),
      ["High", "Mid", "Low"],
    );
  });
});

describe("resolveTeamPlayerStatsSource", () => {
  const preNfl = {
    season: "2026",
    season_type: "pre",
    week: 2,
    display_week: 2,
  };

  it("uses this week's actuals once counting games have started", () => {
    const source = resolveTeamPlayerStatsSource({
      nfl: preNfl,
      schedule: {
        playEachOtherTimes: 1,
        includePreseason: true,
        preseasonStartWeek: 1,
      },
      seasonYear: 2026,
    });

    assert.equal(source.kind, "stats");
    assert.equal(source.week, 2);
    assert.equal(source.seasonType, "pre");
    assert.deepEqual(source.positionRanks, {
      kind: "stats",
      week: 2,
      seasonType: "pre",
    });
  });

  it("stays on season projections when the league excludes preseason", () => {
    const source = resolveTeamPlayerStatsSource({
      nfl: preNfl,
      schedule: {
        playEachOtherTimes: 1,
        includePreseason: false,
        preseasonStartWeek: 1,
      },
      seasonYear: 2026,
    });

    assert.equal(source.kind, "projection");
    assert.equal(source.week, 0);
    assert.equal(source.seasonType, "regular");
  });
});

describe("overlayTeamPlayerStatRows", () => {
  it("replaces projections with weekly actuals and clears unplayed rows", () => {
    const universe = [
      player({
        id: "hou",
        fullName: "Houston Texans",
        primaryPositionId: "DEF",
        fantasyPts: 149,
        positionRank: 8,
        stats: { adp_ppr: 12, sack: 48, pts_allow: 300 },
      }),
      player({
        id: "puka",
        fullName: "Puka Nacua",
        primaryPositionId: "WR",
        fantasyPts: 315.5,
        positionRank: 1,
        stats: { adp_ppr: 4, rec: 110, rec_yd: 1400 },
      }),
    ];
    const actuals = [
      player({
        id: "hou",
        fullName: "Houston Texans",
        primaryPositionId: "DEF",
        fantasyPts: 7,
        positionRank: 4,
        stats: { sack: 2, int: 1, pts_allow: 27 },
      }),
    ];

    const rows = overlayTeamPlayerStatRows(universe, actuals);
    assert.equal(rows[0]?.fantasyPts, 7);
    assert.equal(rows[0]?.stats.sack, 2);
    assert.equal(rows[0]?.stats.adp_ppr, 12);
    assert.equal(rows[0]?.positionRank, 4);
    assert.equal(rows[1]?.fantasyPts, null);
    assert.equal(rows[1]?.stats.rec_yd, undefined);
    assert.equal(rows[1]?.stats.adp_ppr, 4);
    assert.equal(rows[1]?.positionRank, 1);
  });
});
