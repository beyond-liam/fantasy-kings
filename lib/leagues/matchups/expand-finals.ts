/**
 * Expands final matchup rows into per-team weekly score rows.
 * Filters out matchups with null points (not yet finalized).
 */
export function expandFinalMatchupRows(
  finals: ReadonlyArray<{
    week: number;
    homeTeamId: string;
    awayTeamId: string;
    homePts: number | null;
    awayPts: number | null;
  }>,
): Array<{ week: number; teamId: string; pts: number }> {
  const rows: Array<{ week: number; teamId: string; pts: number }> = [];

  for (const matchup of finals) {
    if (matchup.homePts == null || matchup.awayPts == null) {
      continue;
    }

    rows.push({
      week: matchup.week,
      teamId: matchup.homeTeamId,
      pts: matchup.homePts,
    });

    rows.push({
      week: matchup.week,
      teamId: matchup.awayTeamId,
      pts: matchup.awayPts,
    });
  }

  return rows;
}
