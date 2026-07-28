import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildOptimalRecordSummary,
  buildPositionMix,
  buildScoringConcentration,
  buildTeamStatsKpis,
  buildWeeklyBenchWaste,
  buildWeeklyLuck,
  buildWeeklyPointsBand,
  formatRecordSummary,
  median,
  pickStrongestPosition,
  rateScoreConsistency,
  summarizeMatchupLuck,
} from "@/lib/leagues/team-stats-charts";

describe("median", () => {
  it("handles odd and even lengths", () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 2, 3]), 2.5);
  });
});

describe("buildWeeklyPointsBand", () => {
  it("builds team line plus league high/low/median per week", () => {
    const points = buildWeeklyPointsBand({
      teamId: "a",
      finals: [
        {
          week: 1,
          homeTeamId: "a",
          awayTeamId: "b",
          homePts: 120,
          awayPts: 100,
        },
        {
          week: 1,
          homeTeamId: "c",
          awayTeamId: "d",
          homePts: 90,
          awayPts: 80,
        },
        {
          week: 2,
          homeTeamId: "b",
          awayTeamId: "a",
          homePts: 110,
          awayPts: 95,
        },
      ],
    });

    assert.equal(points.length, 2);
    assert.deepEqual(points[0], {
      week: 1,
      label: "W1",
      team: 120,
      high: 120,
      low: 80,
      median: 95,
    });
    assert.equal(points[1]?.team, 95);
    assert.equal(points[1]?.high, 110);
    assert.equal(points[1]?.low, 95);
  });

  it("skips unscored finals", () => {
    const points = buildWeeklyPointsBand({
      teamId: "a",
      finals: [
        {
          week: 1,
          homeTeamId: "a",
          awayTeamId: "b",
          homePts: null,
          awayPts: null,
        },
      ],
    });
    assert.equal(points.length, 0);
  });
});

describe("buildPositionMix", () => {
  it("computes team and league share percentages", () => {
    const rows = buildPositionMix({
      teamByPosition: { QB: 50, RB: 50, WR: 0 },
      leagueByPosition: { QB: 100, RB: 200, WR: 100 },
      positionColumns: ["QB", "RB", "WR"],
    });

    const qb = rows.find((r) => r.positionId === "QB");
    const rb = rows.find((r) => r.positionId === "RB");
    assert.equal(qb?.teamShare, 50);
    assert.equal(qb?.leagueShare, 25);
    assert.equal(rb?.teamShare, 50);
    assert.equal(rb?.leagueShare, 50);
  });

  it("returns empty when the team has no position points", () => {
    assert.deepEqual(
      buildPositionMix({
        teamByPosition: {},
        leagueByPosition: { QB: 10 },
        positionColumns: ["QB"],
      }),
      [],
    );
  });
});

describe("buildWeeklyLuck", () => {
  it("scores 0 when you finish 1st and win", () => {
    const rows = buildWeeklyLuck({
      teamId: "a",
      finals: [
        {
          week: 1,
          homeTeamId: "a",
          awayTeamId: "b",
          homePts: 140,
          awayPts: 100,
        },
        {
          week: 1,
          homeTeamId: "c",
          awayTeamId: "d",
          homePts: 90,
          awayPts: 80,
        },
      ],
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.rank, 1);
    assert.equal(rows[0]?.result, "W");
    assert.equal(rows[0]?.luck, 0);
  });

  it("is very lucky when you win near the bottom of the field", () => {
    const rows = buildWeeklyLuck({
      teamId: "f",
      finals: [
        {
          week: 1,
          homeTeamId: "a",
          awayTeamId: "b",
          homePts: 150,
          awayPts: 140,
        },
        {
          week: 1,
          homeTeamId: "c",
          awayTeamId: "d",
          homePts: 130,
          awayPts: 120,
        },
        {
          week: 1,
          homeTeamId: "e",
          awayTeamId: "f",
          homePts: 80,
          awayPts: 90,
        },
      ],
    });

    // 6 teams; f is 5th (beat 1/5); win → (1 - 0.2)*100 = 80
    assert.equal(rows[0]?.rank, 5);
    assert.equal(rows[0]?.result, "W");
    assert.equal(rows[0]?.luck, 80);
  });

  it("is unlucky when you lose as a top scorer", () => {
    const rows = buildWeeklyLuck({
      teamId: "b",
      finals: [
        {
          week: 1,
          homeTeamId: "a",
          awayTeamId: "b",
          homePts: 150,
          awayPts: 140,
        },
        {
          week: 1,
          homeTeamId: "c",
          awayTeamId: "d",
          homePts: 90,
          awayPts: 80,
        },
      ],
    });

    // b is 2nd of 4 (beat 2/3); loss → (0 - 2/3)*100 ≈ -67
    assert.equal(rows[0]?.rank, 2);
    assert.equal(rows[0]?.result, "L");
    assert.equal(rows[0]?.luck, -67);
  });
});

describe("buildWeeklyBenchWaste", () => {
  it("computes left on bench and flip weeks", () => {
    const rows = buildWeeklyBenchWaste({
      snapshots: [
        { week: 1, pointsFor: 100, optimumPointsFor: 120 },
        { week: 2, pointsFor: 110, optimumPointsFor: 110 },
      ],
      opponentByWeek: new Map([
        [1, { opponentPoints: 115, result: "L" }],
        [2, { opponentPoints: 90, result: "W" }],
      ]),
    });

    assert.equal(rows[0]?.leftOnBench, 20);
    assert.equal(rows[0]?.wouldHaveFlipped, true);
    assert.equal(rows[1]?.leftOnBench, 0);
    assert.equal(rows[1]?.wouldHaveFlipped, false);
  });
});

describe("rateScoreConsistency", () => {
  it("bands stddev into labels", () => {
    assert.equal(rateScoreConsistency(1.5), "excellent");
    assert.equal(rateScoreConsistency(12), "good");
    assert.equal(rateScoreConsistency(20), "fair");
    assert.equal(rateScoreConsistency(40), "poor");
  });
});

describe("buildTeamStatsKpis", () => {
  it("builds win/loss margins and weekly score consistency", () => {
    const kpis = buildTeamStatsKpis({
      teamId: "a",
      finals: [
        {
          week: 1,
          homeTeamId: "a",
          awayTeamId: "b",
          homePts: 120,
          awayPts: 100,
        },
        {
          week: 2,
          homeTeamId: "a",
          awayTeamId: "c",
          homePts: 110,
          awayPts: 90,
        },
        {
          week: 3,
          homeTeamId: "d",
          awayTeamId: "a",
          homePts: 130,
          awayPts: 110,
        },
      ],
    });

    assert.equal(kpis.avgWinMargin.average, 20);
    assert.equal(kpis.avgWinMargin.sampleSize, 2);
    assert.equal(kpis.avgLossMargin.average, -20);
    assert.equal(kpis.avgLossMargin.sampleSize, 1);
    assert.equal(kpis.avgWeeklyScore.average, 113.3);
    assert.equal(kpis.avgWeeklyScore.sampleSize, 3);
    assert.ok(kpis.avgWeeklyScore.consistencyPlusMinus != null);
    assert.ok(kpis.avgWeeklyScore.consistency != null);
  });
});

describe("pickStrongestPosition", () => {
  it("picks the largest positive share delta", () => {
    const strongest = pickStrongestPosition([
      {
        positionId: "QB",
        label: "QB",
        fullLabel: "Quarterback",
        points: 100,
        teamShare: 20,
        leagueShare: 22,
      },
      {
        positionId: "RB",
        label: "RB",
        fullLabel: "Running Back",
        points: 200,
        teamShare: 35,
        leagueShare: 28,
      },
      {
        positionId: "WR",
        label: "WR",
        fullLabel: "Wide Receiver",
        points: 150,
        teamShare: 30,
        leagueShare: 27,
      },
    ]);
    assert.equal(strongest?.label, "RB");
    assert.equal(strongest?.shareDelta, 7);
  });
});

describe("summarizeMatchupLuck", () => {
  it("maps average luck to a verdict", () => {
    const summary = summarizeMatchupLuck([
      {
        week: 1,
        label: "W1",
        luck: 40,
        rank: 1,
        teamCount: 10,
        result: "W",
        points: 120,
        opponentPoints: 100,
        expectedWinPct: 0.6,
      },
      {
        week: 2,
        label: "W2",
        luck: 20,
        rank: 3,
        teamCount: 10,
        result: "W",
        points: 110,
        opponentPoints: 105,
        expectedWinPct: 0.5,
      },
    ]);
    assert.equal(summary?.averageLuck, 30);
    assert.equal(summary?.verdict, "Lucky");
  });
});

describe("buildOptimalRecordSummary", () => {
  it("compares actual H2H to OPF outcomes", () => {
    const rows = buildWeeklyBenchWaste({
      snapshots: [
        { week: 1, pointsFor: 100, optimumPointsFor: 120 },
        { week: 2, pointsFor: 110, optimumPointsFor: 110 },
        { week: 3, pointsFor: 90, optimumPointsFor: 95 },
      ],
      opponentByWeek: new Map([
        [1, { opponentPoints: 115, result: "L" }],
        [2, { opponentPoints: 90, result: "W" }],
        [3, { opponentPoints: 100, result: "L" }],
      ]),
    });
    const records = buildOptimalRecordSummary(rows);
    assert.deepEqual(records?.actual, { wins: 1, losses: 2, ties: 0 });
    assert.deepEqual(records?.optimal, { wins: 2, losses: 1, ties: 0 });
    assert.equal(formatRecordSummary(records!.optimal), "2–1");
  });
});

describe("buildScoringConcentration", () => {
  it("computes top-N share and rest slice from known totals", () => {
    const result = buildScoringConcentration({
      players: [
        { playerId: "a", fullName: "Alpha", points: 100 },
        { playerId: "b", fullName: "Bravo", points: 80 },
        { playerId: "c", fullName: "Charlie", points: 60 },
        { playerId: "d", fullName: "Delta", points: 40 },
        { playerId: "e", fullName: "Echo", points: 20 },
      ],
      topN: 3,
    });

    assert.equal(result.totalPoints, 300);
    assert.equal(result.topShare, 80);
    assert.equal(result.slices.length, 4);
    assert.equal(result.slices[0]?.label, "Alpha");
    assert.equal(result.slices[0]?.share, 33.3);
    assert.equal(result.slices[3]?.isRest, true);
    assert.equal(result.slices[3]?.points, 60);
    assert.equal(result.slices[3]?.share, 20);
  });

  it("returns empty for no points", () => {
    const result = buildScoringConcentration({ players: [] });
    assert.equal(result.slices.length, 0);
    assert.equal(result.topShare, null);
    assert.equal(result.totalPoints, 0);
  });

  it("omits rest when fewer than topN scorers", () => {
    const result = buildScoringConcentration({
      players: [
        { playerId: "a", fullName: "Alpha", points: 50 },
        { playerId: "b", fullName: "Bravo", points: 50 },
      ],
      topN: 3,
    });
    assert.equal(result.topShare, 100);
    assert.equal(result.slices.length, 2);
    assert.ok(result.slices.every((s) => !s.isRest));
  });
});
