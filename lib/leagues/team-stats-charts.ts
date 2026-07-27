import {
  formatLeaderPositionFullLabel,
  formatLeaderPositionLabel,
} from "@/lib/leagues/league-position-stats";

export type FinalScoreRow = {
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  homePts: number | null;
  awayPts: number | null;
};

export type WeeklyPointsBandPoint = {
  week: number;
  label: string;
  team: number | null;
  high: number;
  low: number;
  median: number;
};

export type PositionMixPoint = {
  positionId: string;
  label: string;
  fullLabel: string;
  points: number;
  /** 0–100 share of this team's starter PF. */
  teamShare: number;
  /** 0–100 league-average share of starter PF at this slot. */
  leagueShare: number;
};

export type WeeklyLuckPoint = {
  week: number;
  label: string;
  /** (actual − expected) × 100, rounded. Positive = lucky. */
  luck: number;
  /** 1 = highest PF that week. */
  rank: number;
  teamCount: number;
  result: "W" | "L" | "T";
  points: number;
  opponentPoints: number;
  /** All-play win rate 0–1 (beats + half ties). */
  expectedWinPct: number;
};

/** Median of a non-empty numeric list (sorted copy). */
export function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

/**
 * Per-week PF for `teamId` plus league high / low / median from finals.
 * Weeks with no scored finals are omitted.
 */
export function buildWeeklyPointsBand(input: {
  teamId: string;
  finals: FinalScoreRow[];
}): WeeklyPointsBandPoint[] {
  const byWeek = new Map<number, number[]>();
  const teamByWeek = new Map<number, number>();

  for (const row of input.finals) {
    if (row.homePts == null || row.awayPts == null) {
      continue;
    }

    const scores = byWeek.get(row.week) ?? [];
    scores.push(row.homePts, row.awayPts);
    byWeek.set(row.week, scores);

    if (row.homeTeamId === input.teamId) {
      teamByWeek.set(row.week, row.homePts);
    } else if (row.awayTeamId === input.teamId) {
      teamByWeek.set(row.week, row.awayPts);
    }
  }

  const weeks = [...byWeek.keys()].sort((a, b) => a - b);
  return weeks.map((week) => {
    const scores = byWeek.get(week) ?? [];
    return {
      week,
      label: `W${week}`,
      team: teamByWeek.get(week) ?? null,
      high: Math.max(...scores),
      low: Math.min(...scores),
      median: Math.round(median(scores) * 10) / 10,
    };
  });
}

/**
 * Season starter PF mix for one team vs league-average share by slot.
 * Uses summed `byPosition` maps (e.g. from team_week_stats).
 */
export function buildPositionMix(input: {
  teamByPosition: Record<string, number>;
  /** Summed starter points by position across claimed teams. */
  leagueByPosition: Record<string, number>;
  positionColumns: string[];
}): PositionMixPoint[] {
  const teamTotal = input.positionColumns.reduce(
    (sum, id) => sum + (input.teamByPosition[id] ?? 0),
    0,
  );
  const leagueTotal = input.positionColumns.reduce(
    (sum, id) => sum + (input.leagueByPosition[id] ?? 0),
    0,
  );

  if (teamTotal <= 0) {
    return [];
  }

  return input.positionColumns
    .map((positionId) => {
      const points = input.teamByPosition[positionId] ?? 0;
      const leaguePoints = input.leagueByPosition[positionId] ?? 0;
      return {
        positionId,
        label: formatLeaderPositionLabel(positionId),
        fullLabel: formatLeaderPositionFullLabel(positionId),
        points: Math.round(points * 10) / 10,
        teamShare: Math.round((points / teamTotal) * 1000) / 10,
        leagueShare:
          leagueTotal > 0
            ? Math.round((leaguePoints / leagueTotal) * 1000) / 10
            : 0,
      };
    })
    .filter((row) => row.points > 0 || row.leagueShare > 0);
}

/**
 * Fantasy matchup luck: actual H2H result vs all-play expected win% from
 * weekly scoring rank. Scale matches common FF schedule tables
 * (`round((actual − expected) × 100)`).
 */
export function buildWeeklyLuck(input: {
  teamId: string;
  finals: FinalScoreRow[];
}): WeeklyLuckPoint[] {
  type WeekTeam = {
    teamId: string;
    points: number;
    opponentId: string;
    opponentPoints: number;
  };

  const byWeek = new Map<number, WeekTeam[]>();

  for (const row of input.finals) {
    if (row.homePts == null || row.awayPts == null) {
      continue;
    }

    const list = byWeek.get(row.week) ?? [];
    list.push(
      {
        teamId: row.homeTeamId,
        points: row.homePts,
        opponentId: row.awayTeamId,
        opponentPoints: row.awayPts,
      },
      {
        teamId: row.awayTeamId,
        points: row.awayPts,
        opponentId: row.homeTeamId,
        opponentPoints: row.homePts,
      },
    );
    byWeek.set(row.week, list);
  }

  const weeks = [...byWeek.keys()].sort((a, b) => a - b);
  const points: WeeklyLuckPoint[] = [];

  for (const week of weeks) {
    const teams = byWeek.get(week) ?? [];
    const focus = teams.find((t) => t.teamId === input.teamId);
    if (!focus || teams.length < 2) {
      continue;
    }

    const teamCount = teams.length;
    const others = teamCount - 1;
    let higher = 0;
    let lower = 0;
    let tied = 0;
    for (const team of teams) {
      if (team.teamId === input.teamId) {
        continue;
      }
      if (team.points > focus.points) {
        higher += 1;
      } else if (team.points < focus.points) {
        lower += 1;
      } else {
        tied += 1;
      }
    }

    const expectedWinPct = (lower + tied * 0.5) / others;
    const result: WeeklyLuckPoint["result"] =
      focus.points > focus.opponentPoints
        ? "W"
        : focus.points < focus.opponentPoints
          ? "L"
          : "T";
    const actual = result === "W" ? 1 : result === "L" ? 0 : 0.5;
    const luck = Math.round((actual - expectedWinPct) * 100);

    points.push({
      week,
      label: `W${week}`,
      luck,
      rank: higher + 1,
      teamCount,
      result,
      points: Math.round(focus.points * 10) / 10,
      opponentPoints: Math.round(focus.opponentPoints * 10) / 10,
      expectedWinPct: Math.round(expectedWinPct * 1000) / 1000,
    });
  }

  return points;
}

export type WeeklyBenchWastePoint = {
  week: number;
  label: string;
  /** OPF − PF (floored at 0). */
  leftOnBench: number;
  pointsFor: number;
  optimumPointsFor: number;
  opponentPoints: number | null;
  result: "W" | "L" | "T" | null;
  /** Lost in H2H but optimum PF would have beaten the opponent. */
  wouldHaveFlipped: boolean;
};

/**
 * Weekly points left on bench from persisted PF / OPF snapshots.
 * `opponentByWeek` (from finals) enables the “would have flipped” flag.
 */
export function buildWeeklyBenchWaste(input: {
  snapshots: Array<{
    week: number;
    pointsFor: number | null;
    optimumPointsFor: number | null;
  }>;
  opponentByWeek?: Map<
    number,
    { opponentPoints: number; result: "W" | "L" | "T" }
  >;
}): WeeklyBenchWastePoint[] {
  const points: WeeklyBenchWastePoint[] = [];

  for (const row of input.snapshots) {
    if (row.pointsFor == null || row.optimumPointsFor == null) {
      continue;
    }

    const pointsFor = Math.round(row.pointsFor * 10) / 10;
    const optimumPointsFor = Math.round(row.optimumPointsFor * 10) / 10;
    const leftOnBench =
      Math.round(Math.max(0, optimumPointsFor - pointsFor) * 10) / 10;
    const matchup = input.opponentByWeek?.get(row.week) ?? null;
    const wouldHaveFlipped = Boolean(
      matchup &&
        matchup.result === "L" &&
        optimumPointsFor > matchup.opponentPoints,
    );

    points.push({
      week: row.week,
      label: `W${row.week}`,
      leftOnBench,
      pointsFor,
      optimumPointsFor,
      opponentPoints: matchup?.opponentPoints ?? null,
      result: matchup?.result ?? null,
      wouldHaveFlipped,
    });
  }

  return points.toSorted((a, b) => a.week - b.week);
}

/** Opponent score + H2H result per week for a focus team (from finals). */
export function buildOpponentByWeekFromFinals(input: {
  teamId: string;
  finals: FinalScoreRow[];
}): Map<number, { opponentPoints: number; result: "W" | "L" | "T" }> {
  const map = new Map<
    number,
    { opponentPoints: number; result: "W" | "L" | "T" }
  >();

  for (const row of input.finals) {
    if (row.homePts == null || row.awayPts == null) {
      continue;
    }

    let points: number;
    let opponentPoints: number;
    if (row.homeTeamId === input.teamId) {
      points = row.homePts;
      opponentPoints = row.awayPts;
    } else if (row.awayTeamId === input.teamId) {
      points = row.awayPts;
      opponentPoints = row.homePts;
    } else {
      continue;
    }

    const result: "W" | "L" | "T" =
      points > opponentPoints ? "W" : points < opponentPoints ? "L" : "T";
    map.set(row.week, {
      opponentPoints: Math.round(opponentPoints * 10) / 10,
      result,
    });
  }

  return map;
}

export type ConsistencyRating = "excellent" | "good" | "fair" | "poor";

export type SimpleAverageMetric = {
  average: number | null;
  sampleSize: number;
};

export type ConsistencyAverageMetric = SimpleAverageMetric & {
  /** Sample stddev of weekly scores (± band). */
  consistencyPlusMinus: number | null;
  consistency: ConsistencyRating | null;
};

export type TeamStatsKpis = {
  avgWinMargin: SimpleAverageMetric;
  avgLossMargin: SimpleAverageMetric;
  avgWeeklyScore: ConsistencyAverageMetric;
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function sampleStdDev(values: number[]): number | null {
  if (values.length < 2) {
    return null;
  }
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Map weekly-score volatility (± pts) to a short consistency label. */
export function rateScoreConsistency(
  plusMinus: number | null,
): ConsistencyRating | null {
  if (plusMinus == null) {
    return null;
  }
  if (plusMinus <= 8) return "excellent";
  if (plusMinus <= 15) return "good";
  if (plusMinus <= 25) return "fair";
  return "poor";
}

function meanOrNull(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return round1(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * KPI strip: avg win margin, avg loss margin, avg weekly score.
 * Consistency (± stddev) applies only to weekly score.
 */
export function buildTeamStatsKpis(input: {
  teamId: string;
  finals: FinalScoreRow[];
}): TeamStatsKpis {
  const winMargins: number[] = [];
  const lossMargins: number[] = [];
  const weeklyScores: number[] = [];

  for (const row of input.finals) {
    if (row.homePts == null || row.awayPts == null) {
      continue;
    }

    let points: number;
    let opponentPoints: number;
    if (row.homeTeamId === input.teamId) {
      points = row.homePts;
      opponentPoints = row.awayPts;
    } else if (row.awayTeamId === input.teamId) {
      points = row.awayPts;
      opponentPoints = row.homePts;
    } else {
      continue;
    }

    const score = round1(points);
    const margin = round1(points - opponentPoints);
    weeklyScores.push(score);
    if (margin > 0) {
      winMargins.push(margin);
    } else if (margin < 0) {
      lossMargins.push(margin);
    }
  }

  const consistencyPlusMinus = (() => {
    const sd = sampleStdDev(weeklyScores);
    return sd == null ? null : round1(sd);
  })();

  return {
    avgWinMargin: {
      average: meanOrNull(winMargins),
      sampleSize: winMargins.length,
    },
    avgLossMargin: {
      average: meanOrNull(lossMargins),
      sampleSize: lossMargins.length,
    },
    avgWeeklyScore: {
      average: meanOrNull(weeklyScores),
      sampleSize: weeklyScores.length,
      consistencyPlusMinus,
      consistency: rateScoreConsistency(consistencyPlusMinus),
    },
  };
}

export type StrongestPositionInsight = {
  positionId: string;
  label: string;
  fullLabel: string;
  /** teamShare − leagueShare (percentage points). */
  shareDelta: number;
};

/** Position where team share beats league avg by the largest margin. */
export function pickStrongestPosition(
  rows: PositionMixPoint[],
): StrongestPositionInsight | null {
  let best: StrongestPositionInsight | null = null;
  for (const row of rows) {
    const shareDelta = Math.round((row.teamShare - row.leagueShare) * 10) / 10;
    if (shareDelta <= 0) {
      continue;
    }
    if (!best || shareDelta > best.shareDelta) {
      best = {
        positionId: row.positionId,
        label: row.label,
        fullLabel: row.fullLabel,
        shareDelta,
      };
    }
  }
  return best;
}

export type LuckVerdict =
  | "Extremely lucky"
  | "Lucky"
  | "Slightly lucky"
  | "Even"
  | "Slightly unlucky"
  | "Quite unlucky"
  | "Extremely unlucky";

/** Season luck label from mean weekly all-play luck score. */
export function summarizeMatchupLuck(
  rows: WeeklyLuckPoint[],
): { verdict: LuckVerdict; averageLuck: number } | null {
  if (rows.length === 0) {
    return null;
  }
  const averageLuck = Math.round(
    rows.reduce((sum, row) => sum + row.luck, 0) / rows.length,
  );
  let verdict: LuckVerdict;
  if (averageLuck >= 40) verdict = "Extremely lucky";
  else if (averageLuck >= 15) verdict = "Lucky";
  else if (averageLuck > 5) verdict = "Slightly lucky";
  else if (averageLuck >= -5) verdict = "Even";
  else if (averageLuck > -15) verdict = "Slightly unlucky";
  else if (averageLuck > -40) verdict = "Quite unlucky";
  else verdict = "Extremely unlucky";

  return { verdict, averageLuck };
}

export type RecordSummary = {
  wins: number;
  losses: number;
  ties: number;
};

export function formatRecordSummary(record: RecordSummary): string {
  if (record.ties > 0) {
    return `${record.wins}–${record.losses}–${record.ties}`;
  }
  return `${record.wins}–${record.losses}`;
}

/**
 * Actual H2H record vs record if you’d scored weekly OPF each week.
 * Uses bench-waste weeks that include opponent/result.
 */
export function buildOptimalRecordSummary(
  rows: WeeklyBenchWastePoint[],
): {
  actual: RecordSummary;
  optimal: RecordSummary;
} | null {
  const scored = rows.filter(
    (row) =>
      row.result != null &&
      row.opponentPoints != null &&
      row.optimumPointsFor != null,
  );
  if (scored.length === 0) {
    return null;
  }

  const actual: RecordSummary = { wins: 0, losses: 0, ties: 0 };
  const optimal: RecordSummary = { wins: 0, losses: 0, ties: 0 };

  for (const row of scored) {
    if (row.result === "W") actual.wins += 1;
    else if (row.result === "L") actual.losses += 1;
    else actual.ties += 1;

    const opp = row.opponentPoints!;
    if (row.optimumPointsFor > opp) optimal.wins += 1;
    else if (row.optimumPointsFor < opp) optimal.losses += 1;
    else optimal.ties += 1;
  }

  return { actual, optimal };
}
