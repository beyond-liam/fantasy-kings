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

export function buildScheduleDisplayRows(input: {
  rows: TeamScheduleRow[];
  weekRangeByNumber: Map<number, string>;
  records: Map<string, { wins: number; losses: number; ties: number }>;
  winChances?: Map<string, number | null>;
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
      weeklyRank: null,
      winChance: input.winChances?.get(row.id) ?? null,
    };
  });
}
