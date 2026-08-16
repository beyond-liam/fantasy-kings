import type { ScheduleSettings } from "@/db/schema/league-seasons";
import { resolveScheduleSettings } from "@/lib/leagues/schedule/settings";
import { statsWeekHasOccurred } from "@/lib/rankings/table-rank-source";

export type RosterWeekScore = {
  playerId: string;
  week: number;
  seasonType: string;
  appeared: boolean;
  fantasyPts: number | null;
};

export function seasonTypesForRosterTotals(
  schedule?: ScheduleSettings | null,
  currentType?: string,
): string[] {
  const types = new Set<string>(["regular"]);
  if (resolveScheduleSettings(schedule).includePreseason) {
    types.add("pre");
  }
  if (currentType === "post") {
    types.add("post");
  }
  return [...types];
}

export function accumulateRosterSeasonTotals(
  weeks: RosterWeekScore[],
  statsPoint: { week: number; seasonType?: string },
): Map<string, { fantasyPts: number | null; avgPts: number | null }> {
  const totals = new Map<string, { pts: number; gp: number }>();

  for (const row of weeks) {
    if (
      !statsWeekHasOccurred(
        { week: row.week, seasonType: row.seasonType },
        statsPoint,
      )
    ) {
      continue;
    }
    if (!row.appeared || row.fantasyPts == null || !Number.isFinite(row.fantasyPts)) {
      continue;
    }
    const current = totals.get(row.playerId) ?? { pts: 0, gp: 0 };
    current.pts += row.fantasyPts;
    current.gp += 1;
    totals.set(row.playerId, current);
  }

  const result = new Map<
    string,
    { fantasyPts: number | null; avgPts: number | null }
  >();
  for (const [playerId, { pts, gp }] of totals) {
    result.set(playerId, {
      fantasyPts: Math.round(pts * 100) / 100,
      avgPts: gp > 0 ? Math.round((pts / gp) * 100) / 100 : null,
    });
  }
  return result;
}
