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

/**
 * Expands final matchup rows into per-team weekly score rows with opponent data.
 * Filters out matchups with null points (not yet finalized).
 * Includes opponent team ID and points for win/loss/tie calculations.
 */
export function expandFinalMatchupRowsWithOpponent(
  finals: ReadonlyArray<{
    week: number;
    homeTeamId: string;
    awayTeamId: string;
    homePts: number | null;
    awayPts: number | null;
  }>,
): Array<{
  week: number;
  teamId: string;
  pts: number;
  opponentTeamId: string;
  opponentPts: number;
}> {
  const rows: Array<{
    week: number;
    teamId: string;
    pts: number;
    opponentTeamId: string;
    opponentPts: number;
  }> = [];

  for (const matchup of finals) {
    if (matchup.homePts == null || matchup.awayPts == null) {
      continue;
    }

    rows.push({
      week: matchup.week,
      teamId: matchup.homeTeamId,
      pts: matchup.homePts,
      opponentTeamId: matchup.awayTeamId,
      opponentPts: matchup.awayPts,
    });

    rows.push({
      week: matchup.week,
      teamId: matchup.awayTeamId,
      pts: matchup.awayPts,
      opponentTeamId: matchup.homeTeamId,
      opponentPts: matchup.homePts,
    });
  }

  return rows;
}
