import type { TeamScheduleRow } from "@/lib/queries/matchups";

export type ScheduleDisplayRow = TeamScheduleRow & {
  weekRangeLabel: string;
  opponentWins: number;
  opponentLosses: number;
  opponentTies: number;
  result: "win" | "loss" | "tie" | null;
  weeklyRank: number | null;
  winChance: number | null;
};

export type FinalMatchupForRank = {
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  homePts: number | null;
  awayPts: number | null;
};

export function scheduleMatchupResult(
  row: Pick<
    TeamScheduleRow,
    "status" | "isHome" | "homePts" | "awayPts"
  >,
): "win" | "loss" | "tie" | null {
  if (row.status !== "final" || row.homePts == null || row.awayPts == null) {
    return null;
  }
  const teamPts = row.isHome ? row.homePts : row.awayPts;
  const opponentPts = row.isHome ? row.awayPts : row.homePts;
  const diff = teamPts - opponentPts;
  if (Math.abs(diff) <= 0.05) return "tie";
  return diff > 0 ? "win" : "loss";
}

/** Weekly scoring rank (1 = highest) for a focus team from final matchups. */
export function weeklyRanksByWeekFromFinals(
  finals: FinalMatchupForRank[],
  focusTeamId: string,
): Map<number, number> {
  const scoresByWeek = new Map<number, Array<{ teamId: string; pts: number }>>();

  for (const row of finals) {
    if (row.homePts == null || row.awayPts == null) continue;
    const weekScores = scoresByWeek.get(row.week) ?? [];
    weekScores.push({ teamId: row.homeTeamId, pts: row.homePts });
    weekScores.push({ teamId: row.awayTeamId, pts: row.awayPts });
    scoresByWeek.set(row.week, weekScores);
  }

  const ranks = new Map<number, number>();
  for (const [week, scores] of scoresByWeek) {
    const sorted = scores.toSorted((a, b) => b.pts - a.pts);
    let i = 0;
    while (i < sorted.length) {
      let j = i + 1;
      while (
        j < sorted.length &&
        Math.abs(sorted[j]!.pts - sorted[i]!.pts) <= 0.05
      ) {
        j += 1;
      }
      const rank = i + 1;
      for (let k = i; k < j; k++) {
        if (sorted[k]!.teamId === focusTeamId) {
          ranks.set(week, rank);
        }
      }
      i = j;
    }
  }
  return ranks;
}

export function buildScheduleDisplayRows(input: {
  rows: TeamScheduleRow[];
  weekRangeByNumber: Map<number, string>;
  records: Map<string, { wins: number; losses: number; ties: number }>;
  winChances?: Map<string, number | null>;
  weeklyRanksByWeek?: Map<number, number>;
}): ScheduleDisplayRow[] {
  return input.rows.map((row) => {
    const record = input.records.get(row.opponentTeamId) ?? {
      wins: 0,
      losses: 0,
      ties: 0,
    };
    return {
      ...row,
      weekRangeLabel: input.weekRangeByNumber.get(row.week) ?? "",
      opponentWins: record.wins,
      opponentLosses: record.losses,
      opponentTies: record.ties,
      result: scheduleMatchupResult(row),
      weeklyRank: input.weeklyRanksByWeek?.get(row.week) ?? null,
      winChance: input.winChances?.get(row.id) ?? null,
    };
  });
}
