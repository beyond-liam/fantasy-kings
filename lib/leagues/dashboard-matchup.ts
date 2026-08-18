export type DashboardMatchupRow = {
  week: number;
  status: "scheduled" | "in_progress" | "final";
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homePts: number | null;
  awayPts: number | null;
};

export type DashboardMatchupHighlight =
  | {
      kind: "upcoming";
      week: number;
      opponentName: string;
    }
  | {
      kind: "result";
      week: number;
      opponentName: string;
      result: "W" | "L" | "T";
      ownPts: number;
      oppPts: number;
    };

function opponentName(teamId: string, row: DashboardMatchupRow) {
  return row.homeTeamId === teamId ? row.awayTeamName : row.homeTeamName;
}

function resultFromScores(
  teamId: string,
  row: DashboardMatchupRow,
): DashboardMatchupHighlight | null {
  if (row.homePts == null || row.awayPts == null) return null;
  const isHome = row.homeTeamId === teamId;
  const ownPts = isHome ? row.homePts : row.awayPts;
  const oppPts = isHome ? row.awayPts : row.homePts;
  const result: "W" | "L" | "T" =
    ownPts > oppPts ? "W" : ownPts < oppPts ? "L" : "T";
  return {
    kind: "result",
    week: row.week,
    opponentName: opponentName(teamId, row),
    result,
    ownPts: Math.round(ownPts * 10) / 10,
    oppPts: Math.round(oppPts * 10) / 10,
  };
}

/** Prefer this week's live/upcoming game; otherwise the latest final. */
export function pickDashboardMatchupHighlight(
  teamId: string,
  rows: DashboardMatchupRow[],
  currentWeek: number | null,
): DashboardMatchupHighlight | null {
  const mine = rows.filter(
    (row) => row.homeTeamId === teamId || row.awayTeamId === teamId,
  );
  if (mine.length === 0) return null;

  const thisWeek =
    currentWeek != null
      ? mine.find((row) => row.week === currentWeek)
      : undefined;

  if (thisWeek && thisWeek.status !== "final") {
    return {
      kind: "upcoming",
      week: thisWeek.week,
      opponentName: opponentName(teamId, thisWeek),
    };
  }

  if (thisWeek?.status === "final") {
    const result = resultFromScores(teamId, thisWeek);
    if (result) return result;
  }

  const latestFinal = mine
    .filter((row) => row.status === "final" && row.homePts != null && row.awayPts != null)
    .toSorted((a, b) => b.week - a.week)[0];
  if (latestFinal) {
    return resultFromScores(teamId, latestFinal);
  }

  const nextUpcoming = mine
    .filter((row) => row.status !== "final")
    .toSorted((a, b) => a.week - b.week)[0];
  if (nextUpcoming) {
    return {
      kind: "upcoming",
      week: nextUpcoming.week,
      opponentName: opponentName(teamId, nextUpcoming),
    };
  }

  return null;
}
