import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDefaultScoringRuleDefinitions } from "@/lib/leagues/scoring/defaults";
import {
  buildPlayerOverviewMetrics,
  buildQbScoringSummary,
  buildRbScoringSummary,
  buildReceiverScoringSummary,
  buildKickerScoringSummary,
  buildDefScoringSummary,
  buildScoringConsistency,
  classifyQbScoringArchetype,
  classifyRbScoringArchetype,
  classifyReceiverScoringArchetype,
  classifyKickerScoringArchetype,
  formatOpponentTick,
  parseOpponentMeta,
  type PlayerOverviewInput,
} from "@/lib/players/overview-metrics";

const rules = getDefaultScoringRuleDefinitions("full_ppr");
const standardRules = getDefaultScoringRuleDefinitions("standard");

function baseProfile(
  overrides: Partial<PlayerOverviewInput> = {},
): PlayerOverviewInput {
  return {
    primaryPositionId: "WR",
    positionRank: 12,
    byeWeek: 10,
    season: "2025",
    seasonProjection: null,
    seasonStats: {
      fantasyPts: 170,
      stats: { rec: 80, rec_yd: 1000, rec_td: 8, rec_tgt: 120, gp: 17 },
    },
    gameLog: [
      { week: 1, opponent: "vs BAL", fantasyPts: 12 },
      { week: 2, opponent: "@ BUF", fantasyPts: 8 },
      { week: 3, opponent: "vs CIN", fantasyPts: 22 },
      { week: 10, opponent: "BYE", fantasyPts: null },
      { week: 11, opponent: "vs LV", fantasyPts: 18 },
    ],
    ...overrides,
  };
}

function rbProfile(
  overrides: Partial<PlayerOverviewInput> = {},
): PlayerOverviewInput {
  return baseProfile({
    primaryPositionId: "RB",
    positionRank: 4,
    seasonStats: {
      fantasyPts: 220,
      stats: {
        rush_att: 185,
        rush_yd: 920,
        rush_td: 8,
        rec: 42,
        rec_yd: 310,
        rec_td: 2,
        rec_tgt: 55,
        gp: 11,
      },
    },
    gameLog: [
      { week: 1, opponent: "vs SEA", fantasyPts: 18 },
      { week: 2, opponent: "@ LAR", fantasyPts: 12 },
      { week: 3, opponent: "vs ARI", fantasyPts: 24 },
      { week: 4, opponent: "@ NYG", fantasyPts: 16 },
      { week: 5, opponent: "BYE", fantasyPts: null },
      { week: 6, opponent: "vs DAL", fantasyPts: 21 },
    ],
    overviewExtras: {
      share: {
        kind: "carry",
        label: "Carry share",
        playerPct: 58,
        playerTotal: 185,
        teamTotal: 320,
      },
      weeklyFinishesByWeek: {},
      matchupDifficultyByWeek: {},
      matchupRanksByWeek: {},
      ptsAllowedByWeek: {},
      playoffWeeks: [16, 17],
      regularSeasonEndWeek: 15,
      rosterCompare: [],
      multiYear: [],
    },
    ...overrides,
  });
}

describe("parseOpponentMeta", () => {
  it("parses home, away, and bye", () => {
    assert.deepEqual(parseOpponentMeta("vs BAL"), {
      isBye: false,
      venue: "home",
      abbrev: "BAL",
    });
    assert.deepEqual(parseOpponentMeta("@ BUF"), {
      isBye: false,
      venue: "away",
      abbrev: "BUF",
    });
    assert.deepEqual(parseOpponentMeta("BYE"), {
      isBye: true,
      venue: null,
      abbrev: null,
    });
  });
});

describe("formatOpponentTick", () => {
  it("formats compact home and away ticks", () => {
    assert.equal(formatOpponentTick("away", "DET"), "@DET");
    assert.equal(formatOpponentTick("home", "DET"), "vDET");
    assert.equal(formatOpponentTick(null, "DET"), "DET");
    assert.equal(formatOpponentTick("home", null), null);
  });
});

describe("buildPlayerOverviewMetrics", () => {
  it("marks past unscored weeks as DNP when later weeks have scores", () => {
    const overview = buildPlayerOverviewMetrics(
      baseProfile({
        gameLog: [
          { week: 1, opponent: "vs BAL", fantasyPts: 12 },
          { week: 2, opponent: "@ BUF", fantasyPts: null },
          { week: 3, opponent: "vs CIN", fantasyPts: 22 },
          { week: 10, opponent: "BYE", fantasyPts: null },
          { week: 11, opponent: "vs LV", fantasyPts: 18 },
        ],
      }),
      rules,
    );

    assert.equal(overview.weeklyPoints.find((w) => w.week === 2)?.isDnp, true);
    assert.equal(overview.weeklyPoints.find((w) => w.week === 10)?.isDnp, false);
    assert.equal(overview.weeklyPoints.find((w) => w.week === 10)?.isBye, true);
  });

  it("builds weekly points, floor/ceiling, and splits", () => {
    const overview = buildPlayerOverviewMetrics(baseProfile(), rules);

    assert.equal(overview.gamesPlayed, 4);
    assert.equal(overview.averageFpts, 15);
    assert.equal(overview.weeklyPoints.length, 5);
    assert.equal(
      overview.weeklyPoints.find((w) => w.week === 10)?.isBye,
      true,
    );
    assert.equal(
      overview.weeklyPoints.every((w) => !w.isDnp),
      true,
    );
    assert.ok(overview.floorCeiling);
    assert.equal(overview.floorCeiling.sampleSize, 4);
    assert.ok(overview.floorCeiling.consistencyScore >= 0);
    assert.ok(overview.floorCeiling.consistencyScore <= 100);
    assert.ok(overview.floorCeiling.consistencySummary.includes("Consistency"));
    assert.equal(overview.homeAway?.home.games, 3);
    assert.equal(overview.homeAway?.away.games, 1);
    assert.equal(overview.restImpact?.offBye.games, 1);
    assert.ok(overview.scoringBreakdown.segments.length > 0);
    assert.equal(overview.scoringBreakdown.archetype?.id, "ppr_cushioned");
    assert.ok(
      overview.scoringBreakdown.summary?.startsWith("PPR-cushioned"),
    );
    assert.ok(overview.production.some((t) => t.key === "fpts_weekly"));
    assert.equal(overview.share, null);
    assert.ok(overview.efficiency);
    assert.equal(overview.efficiency.id, "catch_rate");
    assert.equal(overview.weeklyFinish, null);
    assert.equal(overview.matchupDifficulty, null);
    assert.equal(overview.vsLeaders.length, 0);
    assert.ok(overview.rosterCompare.some((row) => row.isViewed));
    assert.equal(overview.multiYear.length, 0);
  });

  it("caps weekly charts at the league season max week", () => {
    const overview = buildPlayerOverviewMetrics(
      baseProfile({
        gameLog: [
          { week: 1, opponent: "vs BAL", fantasyPts: 12 },
          { week: 17, opponent: "@ BUF", fantasyPts: 18 },
          { week: 18, opponent: "vs CIN", fantasyPts: 30 },
        ],
        overviewExtras: {
          share: null,
          weeklyFinishesByWeek: { 1: 10, 17: 5, 18: 2 },
          matchupDifficultyByWeek: {},
          matchupRanksByWeek: {},
          ptsAllowedByWeek: {},
          playoffWeeks: [16, 17],
          regularSeasonEndWeek: 15,
          multiYear: [],
        },
      }),
      rules,
    );

    assert.equal(overview.weeklyPoints.some((w) => w.week === 18), false);
    assert.equal(overview.weeklyPoints.at(-1)?.week, 17);
    assert.equal(overview.gamesPlayed, 2);
    assert.equal(overview.weeklyFinish?.games, 2);
    assert.equal(
      overview.weeklyFinish?.weeks.some((w) => w.week === 18),
      false,
    );
  });

  it("Season Production uses season stats only, never projections", () => {
    const withBoth = buildPlayerOverviewMetrics(
      baseProfile({
        seasonProjection: {
          fantasyPts: 300,
          stats: { rec: 999, rec_yd: 9999, rec_td: 99, rec_tgt: 999, gp: 17 },
        },
        seasonStats: {
          fantasyPts: 170,
          stats: { rec: 80, rec_yd: 1000, rec_td: 8, rec_tgt: 120, gp: 10 },
        },
      }),
      rules,
    );
    assert.equal(
      withBoth.production.find((t) => t.key === "rec")?.value,
      80,
    );

    const projectionOnly = buildPlayerOverviewMetrics(
      baseProfile({
        seasonProjection: {
          fantasyPts: 300,
          stats: { rec: 999, rec_yd: 9999, rec_td: 99, rec_tgt: 999, gp: 17 },
        },
        seasonStats: null,
        gameLog: [],
      }),
      rules,
    );
    assert.equal(projectionOnly.production.length, 0);
  });

  it("hydrates extras seed sections", () => {
    const overview = buildPlayerOverviewMetrics(
      baseProfile({
        id: "player-1",
        fullName: "Test Back",
        overviewExtras: {
          share: {
            kind: "target",
            label: "Target share",
            playerPct: 27,
            playerTotal: 108,
            teamTotal: 400,
          },
          weeklyFinishesByWeek: { 1: 8, 2: 20, 3: 3, 11: 5 },
          matchupDifficultyByWeek: {
            1: "hard",
            2: "hard",
            3: "mid",
            11: "easy",
          },
          matchupRanksByWeek: { 1: 29, 2: 24, 3: 16, 11: 5 },
          ptsAllowedByWeek: { 1: 6.2, 2: 8.4, 3: 12.1, 11: 18.9 },
          playoffWeeks: [16, 17],
          regularSeasonEndWeek: 15,
          rosterCompare: [
            {
              id: "mate-1",
              name: "Roster Mate",
              nflTeam: "KC",
              primaryPositionId: "RB",
              slotLabel: "RB1",
              gamesPlayed: 10,
              carrySharePct: 50,
              ypc: 4.2,
              fptsPerGame: 18,
              totalFpts: 180,
              homeAvg: 19,
              awayAvg: 17,
              floor: 10,
              median: 17,
              ceiling: 24,
              consistencyScore: 70,
              avgWeeklyFinish: 9,
              startablePct: 50,
              remainingSosRank: 15,
            },
          ],
          multiYear: [
            { season: "2025", games: 11, fptsPerGame: 15, positionRank: 12 },
          ],
        },
      }),
      rules,
    );

    assert.ok(overview.share);
    assert.equal(overview.share.cells.filter(Boolean).length, 27);
    assert.ok(overview.efficiency);
    assert.equal(overview.efficiency.id, "catch_rate");
    assert.ok(overview.efficiency.value > 60);
    assert.ok(overview.efficiency.weekly.length >= 0);
    assert.ok(overview.weeklyFinish);
    assert.equal(overview.weeklyFinish.bestFinish, 3);
    assert.ok(overview.matchupDifficulty);
    assert.ok(overview.matchupDifficulty.weeks.length > 0);
    assert.equal(overview.matchupDifficulty.weeks.length, 17);
    assert.deepEqual(overview.matchupDifficulty.playoffWeeks, [16, 17]);
    assert.equal(
      overview.matchupDifficulty.weeks.find((w) => w.week === 15)?.isPlayoff,
      false,
    );
    assert.equal(
      overview.matchupDifficulty.weeks.find((w) => w.week === 16)?.isPlayoff,
      true,
    );
    assert.equal(
      overview.matchupDifficulty.buckets.reduce((sum, b) => sum + b.games, 0),
      overview.matchupDifficulty.weeks.filter((w) => !w.isBye).length,
    );
    assert.ok(
      overview.matchupDifficulty.buckets.some((b) =>
        b.opponents.some(
          (o) => o.label.startsWith("@") || o.label.startsWith("vs"),
        ),
      ),
    );
    assert.equal(overview.rosterCompare.length, 2);
    assert.ok(overview.rosterCompare.some((row) => row.isViewed));
    assert.ok(overview.rosterCompare.some((row) => row.id === "mate-1"));
    assert.equal(overview.multiYear.length, 1);
  });

  it("buckets WR scoring under receiving-first DNA", () => {
    const overview = buildPlayerOverviewMetrics(baseProfile(), rules);
    const ids = overview.scoringBreakdown.segments.map((s) => s.id);

    assert.deepEqual(
      ids.filter((id) => id !== "other"),
      ["rec_yd", "rec", "rec_td"].filter((id) => ids.includes(id)),
    );
    assert.ok(ids.includes("rec_yd"));
    assert.ok(ids.includes("rec"));
    assert.ok(ids.includes("rec_td"));
    assert.equal(
      overview.scoringBreakdown.segments.findIndex((s) => s.id === "rec_yd"),
      0,
    );
  });

  it("buckets QB scoring under pass-then-rush DNA", () => {
    const overview = buildPlayerOverviewMetrics(
      baseProfile({
        primaryPositionId: "QB",
        seasonStats: {
          fantasyPts: 268.4,
          stats: {
            gp: 11,
            pass_yd: 3120,
            pass_td: 24,
            pass_int: 7,
            pass_cmp: 265,
            pass_att: 398,
            rush_yd: 285,
            rush_td: 3,
            rush_att: 48,
          },
        },
      }),
      rules,
    );
    const ids = overview.scoringBreakdown.segments.map((s) => s.id);

    assert.ok(ids.includes("pass_yd"));
    assert.ok(ids.includes("pass_td"));
    assert.ok(ids.includes("rush_yd"));
    assert.ok(ids.includes("rush_td"));
    assert.equal(
      overview.scoringBreakdown.segments.findIndex((s) => s.id === "pass_yd"),
      0,
    );
    assert.ok(
      overview.scoringBreakdown.segments.findIndex((s) => s.id === "pass_td") <
        overview.scoringBreakdown.segments.findIndex((s) => s.id === "rush_yd"),
    );
  });

  it("uses position startable barometers for weekly finish", () => {
    const finishExtras = {
      share: null,
      weeklyFinishesByWeek: {
        1: 8,
        2: 20,
        3: 28,
        11: 15,
      },
      matchupDifficultyByWeek: {},
      matchupRanksByWeek: {},
      ptsAllowedByWeek: {},
      playoffWeeks: [] as number[],
      multiYear: [],
    };

    const wr = buildPlayerOverviewMetrics(
      baseProfile({ overviewExtras: finishExtras }),
      rules,
    );
    assert.equal(wr.weeklyFinish?.startableThreshold, 24);
    assert.equal(wr.weeklyFinish?.startableFinishes, 3);

    const te = buildPlayerOverviewMetrics(
      baseProfile({
        primaryPositionId: "TE",
        overviewExtras: finishExtras,
      }),
      rules,
    );
    assert.equal(te.weeklyFinish?.startableThreshold, 12);
    assert.equal(te.weeklyFinish?.startableFinishes, 1);

    const qb = buildPlayerOverviewMetrics(
      baseProfile({
        primaryPositionId: "QB",
        overviewExtras: finishExtras,
      }),
      rules,
    );
    assert.equal(qb.weeklyFinish?.startableThreshold, 12);
  });

  it("buckets RB scoring DNA under league rules", () => {
    const overview = buildPlayerOverviewMetrics(rbProfile(), rules);
    const ids = overview.scoringBreakdown.segments.map((s) => s.id);

    assert.ok(ids.includes("rush_yd"));
    assert.ok(ids.includes("rush_td"));
    assert.ok(ids.includes("rec"));
    assert.ok(ids.includes("rec_yd"));
    assert.ok(ids.includes("rec_td"));
    assert.ok(
      overview.scoringBreakdown.segments.every(
        (s) => !s.label.includes("point for every"),
      ),
    );
    assert.equal(overview.scoringBreakdown.archetype?.id, "workhorse");
    assert.ok(overview.scoringBreakdown.summary?.startsWith("Volume-driven"));
  });

  it("includes PPR reception points in the Receptions bucket", () => {
    const ppr = buildPlayerOverviewMetrics(rbProfile(), rules);
    const standard = buildPlayerOverviewMetrics(rbProfile(), standardRules);
    const pprRec = ppr.scoringBreakdown.segments.find((s) => s.id === "rec");
    const stdRec = standard.scoringBreakdown.segments.find((s) => s.id === "rec");

    assert.ok(pprRec);
    assert.ok(pprRec.points > (stdRec?.points ?? 0));
  });
});

describe("classifyRbScoringArchetype", () => {
  it("labels three-down backs with balanced rush and receiving", () => {
    const archetype = classifyRbScoringArchetype({
      segments: [
        { id: "rush_yd", label: "Rush yards", points: 90, pct: 35 },
        { id: "rush_td", label: "Rush TDs", points: 30, pct: 12 },
        { id: "rec", label: "Receptions", points: 40, pct: 15 },
        { id: "rec_yd", label: "Rec yards", points: 50, pct: 19 },
        { id: "rec_td", label: "Rec TDs", points: 24, pct: 9 },
      ],
      rushAtt: 165,
      recTgt: 45,
      receptions: 38,
      gamesPlayed: 11,
      carrySharePct: 48,
    });
    assert.equal(archetype?.id, "three_down");
  });

  it("labels change-of-pace backs by elevated target rate", () => {
    const archetype = classifyRbScoringArchetype({
      segments: [
        { id: "rush_yd", label: "Rush yards", points: 40, pct: 20 },
        { id: "rec", label: "Receptions", points: 50, pct: 25 },
        { id: "rec_yd", label: "Rec yards", points: 60, pct: 30 },
        { id: "rec_td", label: "Rec TDs", points: 24, pct: 12 },
      ],
      rushAtt: 80,
      recTgt: 50,
      receptions: 40,
      gamesPlayed: 11,
      carrySharePct: 28,
    });
    assert.equal(archetype?.id, "change_of_pace");
  });

  it("labels touchdown-dependent backs", () => {
    const archetype = classifyRbScoringArchetype({
      segments: [
        { id: "rush_yd", label: "Rush yards", points: 40, pct: 25 },
        { id: "rush_td", label: "Rush TDs", points: 72, pct: 45 },
        { id: "rec_yd", label: "Rec yards", points: 20, pct: 12 },
      ],
      rushAtt: 90,
      recTgt: 12,
      receptions: 8,
      gamesPlayed: 12,
      carrySharePct: 30,
    });
    assert.equal(archetype?.id, "td_dependent");
  });
});

describe("classifyReceiverScoringArchetype", () => {
  it("labels PPR-cushioned WRs from reception share", () => {
    const archetype = classifyReceiverScoringArchetype({
      positionId: "WR",
      segments: [
        { id: "rec_yd", label: "Receiving yards", points: 40, pct: 35 },
        { id: "rec", label: "Receptions", points: 38, pct: 34 },
        { id: "rec_td", label: "Receiving touchdowns", points: 22, pct: 20 },
        { id: "rush_yd", label: "Rushing yards", points: 8, pct: 7 },
      ],
    });
    assert.equal(archetype?.id, "ppr_cushioned");
  });

  it("labels red-zone TEs from receiving TD share", () => {
    const archetype = classifyReceiverScoringArchetype({
      positionId: "TE",
      segments: [
        { id: "rec_yd", label: "Receiving yards", points: 40, pct: 35 },
        { id: "rec", label: "Receptions", points: 30, pct: 26 },
        { id: "rec_td", label: "Receiving touchdowns", points: 35, pct: 30 },
      ],
    });
    assert.equal(archetype?.id, "red_zone_te");
  });
});

describe("classifyQbScoringArchetype", () => {
  it("labels TD-dependent QBs when touchdowns dominate", () => {
    const archetype = classifyQbScoringArchetype({
      segments: [
        { id: "pass_yd", label: "Passing yards", points: 40, pct: 35 },
        { id: "pass_td", label: "Passing touchdowns", points: 30, pct: 26 },
        { id: "rush_yd", label: "Rushing yards", points: 15, pct: 13 },
        { id: "rush_td", label: "Rushing touchdowns", points: 25, pct: 22 },
      ],
    });
    assert.equal(archetype?.id, "td_dependent");
  });

  it("labels dual-threat QBs from rushing share", () => {
    const archetype = classifyQbScoringArchetype({
      segments: [
        { id: "pass_yd", label: "Passing yards", points: 45, pct: 40 },
        { id: "pass_td", label: "Passing touchdowns", points: 20, pct: 18 },
        { id: "rush_yd", label: "Rushing yards", points: 25, pct: 22 },
        { id: "rush_td", label: "Rushing touchdowns", points: 15, pct: 13 },
      ],
    });
    assert.equal(archetype?.id, "dual_threat");
  });
});

describe("buildReceiverScoringSummary", () => {
  it("writes PPR-cushioned copy for receivers", () => {
    const summary = buildReceiverScoringSummary({
      positionId: "WR",
      archetype: {
        id: "ppr_cushioned",
        label: "PPR-cushioned",
        reason: "catches alone supply 34%",
      },
      segments: [
        { id: "rec", label: "Receptions", points: 34, pct: 34 },
        { id: "rec_yd", label: "Receiving yards", points: 40, pct: 40 },
        { id: "rec_td", label: "Receiving touchdowns", points: 20, pct: 20 },
      ],
    });
    assert.equal(summary, "PPR-cushioned — catches alone supply 34%");
  });
});

describe("buildQbScoringSummary", () => {
  it("writes TD-dependent copy for QBs", () => {
    const summary = buildQbScoringSummary({
      archetype: {
        id: "td_dependent",
        label: "TD-dependent",
        reason: "47% of production rides on touchdowns",
      },
      segments: [
        { id: "pass_td", label: "Passing touchdowns", points: 26, pct: 26 },
        { id: "rush_td", label: "Rushing touchdowns", points: 21, pct: 21 },
        { id: "pass_yd", label: "Passing yards", points: 38, pct: 38 },
      ],
    });
    assert.equal(
      summary,
      "TD-dependent — 47% of production rides on touchdowns",
    );
  });
});

describe("classifyKickerScoringArchetype", () => {
  it("labels long-range kickers from 50+ share", () => {
    const archetype = classifyKickerScoringArchetype({
      segments: [
        { id: "fg_short", label: "FG under 40", points: 30, pct: 30 },
        { id: "fg_40", label: "FG 40–49", points: 20, pct: 20 },
        { id: "fg_50", label: "FG 50+", points: 35, pct: 35 },
        { id: "xp", label: "Extra points", points: 15, pct: 15 },
      ],
    });
    assert.equal(archetype?.id, "long_range");
  });

  it("labels XP-driven kickers", () => {
    const archetype = classifyKickerScoringArchetype({
      segments: [
        { id: "fg_short", label: "FG under 40", points: 25, pct: 25 },
        { id: "fg_40", label: "FG 40–49", points: 15, pct: 15 },
        { id: "xp", label: "Extra points", points: 45, pct: 45 },
      ],
    });
    assert.equal(archetype?.id, "xp_driven");
  });
});

describe("buildKickerScoringSummary", () => {
  it("writes long-range copy", () => {
    const summary = buildKickerScoringSummary({
      archetype: {
        id: "long_range",
        label: "Long-range",
        reason: "35% from 50+ yard field goals",
      },
      segments: [
        { id: "fg_50", label: "FG 50+", points: 35, pct: 35 },
        { id: "fg_short", label: "FG under 40", points: 40, pct: 40 },
        { id: "xp", label: "Extra points", points: 25, pct: 25 },
      ],
    });
    assert.equal(summary, "Long-range — 35% from 50+ yard field goals");
  });
});

describe("buildPlayerOverviewMetrics kicker", () => {
  it("builds FG buckets, accuracy, and outdoor splits", () => {
    const overview = buildPlayerOverviewMetrics(
      {
        primaryPositionId: "K",
        positionRank: 6,
        nflTeam: "ATL",
        season: "2026",
        byeWeek: 8,
        seasonProjection: null,
        seasonStats: {
          fantasyPts: 98,
          stats: {
            gp: 10,
            fgm: 22,
            fga: 26,
            fgm_0_19: 1,
            fgm_20_29: 5,
            fgm_30_39: 7,
            fgm_40_49: 6,
            fgm_50p: 3,
            xpm: 26,
            xpa: 27,
          },
        },
        gameLog: [
          {
            week: 1,
            opponent: "@ SEA",
            fantasyPts: 11,
            stats: { fgm: 2, xpm: 2 },
          },
          {
            week: 2,
            opponent: "vs BAL",
            fantasyPts: 5,
            stats: { fgm: 1, xpm: 1 },
          },
          {
            week: 3,
            opponent: "@ DET",
            fantasyPts: 9,
            stats: { fgm: 2, xpm: 3 },
          },
          {
            week: 4,
            opponent: "vs DEN",
            fantasyPts: 8,
            stats: { fgm: 1, xpm: 2 },
          },
        ],
        overviewExtras: {
          share: null,
          weeklyFinishesByWeek: { 1: 6, 2: 22, 3: 8, 4: 14 },
          matchupDifficultyByWeek: {},
          matchupRanksByWeek: {},
          ptsAllowedByWeek: {},
          playoffWeeks: [16, 17],
          multiYear: [],
        },
      },
      rules,
    );

    const ids = overview.scoringBreakdown.segments.map((s) => s.id);
    assert.ok(ids.includes("fg_short"));
    assert.ok(ids.includes("fg_40"));
    assert.ok(ids.includes("fg_50"));
    assert.ok(ids.includes("xp"));
    assert.ok(overview.scoringBreakdown.summary);
    assert.ok(
      overview.production.some((stat) => stat.key === "xpa"),
      "production includes XPA",
    );
    assert.equal(overview.share?.kind, "kick");
    assert.ok(overview.share?.kickBreakdown);
    assert.equal(overview.efficiency, null);
    assert.ok(overview.fgMakeRadar);
    assert.equal(overview.fgMakeRadar?.length, 5);
    assert.equal(overview.fgMakeRadar?.[4]?.leagueAvgPct, 68);
    assert.ok(overview.kickWeeklyMakes);
    assert.equal(overview.kickWeeklyMakes?.[0]?.made, 4);
    assert.equal(overview.kickWeeklyMakes?.[2]?.made, 5);
    assert.ok(overview.outdoorIndoor);
    assert.ok(
      (overview.outdoorIndoor?.outdoor.games ?? 0) +
        (overview.outdoorIndoor?.indoor.games ?? 0) >=
        2,
    );
    assert.equal(overview.restImpact, null);
    assert.equal(overview.weeklyFinish?.startableThreshold, 12);
    assert.equal(overview.floorCeiling?.positionMedianLabel, "K median");
  });
});

describe("buildPlayerOverviewMetrics DEF", () => {
  it("builds forced scoring buckets, PA radar/weekly, and DEF benchmarks", () => {
    const overview = buildPlayerOverviewMetrics(
      {
        primaryPositionId: "DEF",
        positionRank: 8,
        nflTeam: "SF",
        fullName: "49ers",
        season: "2026",
        byeWeek: 8,
        seasonProjection: null,
        seasonStats: {
          fantasyPts: 92,
          stats: {
            gp: 10,
            sack: 31,
            tkl_solo: 41,
            int: 10,
            ff: 9,
            def_td: 2,
            pts_allow: 168,
          },
        },
        gameLog: [
          {
            week: 1,
            opponent: "@ SEA",
            fantasyPts: 12,
            stats: { sack: 4, tkl_solo: 5, int: 1, ff: 1, pts_allow: 10 },
          },
          {
            week: 2,
            opponent: "vs BAL",
            fantasyPts: 4,
            stats: { sack: 1, tkl_solo: 3, pts_allow: 17 },
          },
          {
            week: 3,
            opponent: "@ BUF",
            fantasyPts: 16,
            stats: {
              sack: 5,
              tkl_solo: 4,
              int: 2,
              ff: 1,
              def_td: 1,
              pts_allow: 3,
            },
          },
          {
            week: 4,
            opponent: "vs DEN",
            fantasyPts: 2,
            stats: { sack: 1, tkl_solo: 2, pts_allow: 24 },
          },
          {
            week: 5,
            opponent: "@ CIN",
            fantasyPts: 11,
            stats: { sack: 3, tkl_solo: 5, int: 1, ff: 2, pts_allow: 7 },
          },
        ],
        overviewExtras: {
          share: null,
          weeklyFinishesByWeek: { 1: 5, 2: 24, 3: 2, 4: 28, 5: 7 },
          matchupDifficultyByWeek: {},
          matchupRanksByWeek: {},
          ptsAllowedByWeek: {},
          playoffWeeks: [16, 17],
          multiYear: [],
        },
      },
      rules,
    );

    const ids = overview.scoringBreakdown.segments.map((s) => s.id);
    assert.ok(ids.includes("sack"));
    assert.ok(ids.includes("tkl_solo"), "tackles bucket shown even at 0 pts");
    assert.ok(ids.includes("int"));
    assert.ok(ids.includes("ff"));
    assert.ok(ids.includes("def_td"));
    const tackle = overview.scoringBreakdown.segments.find(
      (s) => s.id === "tkl_solo",
    );
    assert.equal(tackle?.points, 0);
    assert.ok(overview.scoringBreakdown.summary);
    assert.ok(
      overview.production.some((stat) => stat.key === "tkl_solo"),
      "production includes TKL",
    );
    assert.equal(overview.share, null);
    assert.equal(overview.efficiency, null);
    assert.equal(overview.fgMakeRadar, null);
    assert.ok(overview.ptsAllowRadar);
    assert.equal(overview.ptsAllowRadar?.length, 5);
    const gamesSum = overview.ptsAllowRadar!.reduce((s, b) => s + b.games, 0);
    assert.equal(gamesSum, 5);
    assert.ok(
      overview.ptsAllowRadar!.every((b) => b.leagueAvgGames >= 0),
    );
    const twentyTwoPlus = overview.ptsAllowRadar!.find((b) => b.id === "22p");
    assert.equal(twentyTwoPlus?.games, 1);
    const zeroToSeven = overview.ptsAllowRadar!.find((b) => b.id === "0_7");
    assert.equal(zeroToSeven?.games, 2);
    assert.ok(overview.ptsAllowWeekly);
    assert.equal(overview.ptsAllowWeekly?.length, 5);
    assert.equal(overview.ptsAllowWeekly?.[0]?.value, 10);
    assert.equal(overview.ptsAllowWeekly?.[0]?.opponentTick, "@SEA");
    assert.equal(overview.weeklyFinish?.startableThreshold, 12);
    assert.equal(overview.floorCeiling?.positionMedianLabel, "DEF median");
    assert.equal(overview.floorCeiling?.positionMedian, 8);
  });
});

describe("buildDefScoringSummary", () => {
  it("labels pass-rush when sacks dominate", () => {
    const summary = buildDefScoringSummary({
      segments: [
        { id: "sack", label: "Sacks", points: 60, pct: 55 },
        { id: "int", label: "Interceptions", points: 20, pct: 18 },
        { id: "ff", label: "Forced fumbles", points: 14, pct: 13 },
        { id: "def_td", label: "Touchdowns", points: 12, pct: 11 },
        { id: "tkl_solo", label: "Tackles", points: 0, pct: 0 },
      ],
    });
    assert.ok(summary?.startsWith("Pass-rush"));
  });
});

describe("buildRbScoringSummary", () => {
  it("writes balanced copy when no source dominates", () => {
    const summary = buildRbScoringSummary({
      archetype: null,
      segments: [
        { id: "rush_yd", label: "Rush yards", points: 30, pct: 30 },
        { id: "rec", label: "Receptions", points: 25, pct: 25 },
        { id: "rec_yd", label: "Rec yards", points: 25, pct: 25 },
        { id: "rush_td", label: "Rush TDs", points: 20, pct: 20 },
      ],
    });
    assert.equal(
      summary,
      "Balanced profile — no single source dominates the scoring mix",
    );
  });
});

describe("buildScoringConsistency", () => {
  it("scores steady weeks highly", () => {
    const consistency = buildScoringConsistency([12, 13, 12.5, 11.5, 12]);
    assert.ok(consistency);
    assert.ok(consistency.score >= 80);
    assert.equal(consistency.label, "Steady");
  });

  it("scores boom-bust weeks lower", () => {
    const consistency = buildScoringConsistency([4, 28, 6, 30, 5, 26]);
    assert.ok(consistency);
    assert.ok(consistency.score < 60);
    assert.match(consistency.summary, /^Consistency \d+ — /);
  });
});
