import type { LeagueStandingsRow } from "@/lib/leagues/standings";

const OVERVIEW_POSITIONS = ["QB", "RB", "WR", "TE"] as const;

export type OverviewPositionId = (typeof OVERVIEW_POSITIONS)[number];

export { OVERVIEW_POSITIONS };

/**
 * Viewer-relative standings window: 2 above + focus + 2 below.
 * At the top/bottom edge, pad with 4 neighbors on the other side.
 * With no focus (or missing team), show the top of the table.
 */
export function sliceStandingsAroundFocus<T>(
  rows: T[],
  focusIndex: number,
  neighborCount = 2,
): T[] {
  if (rows.length === 0) return [];
  const windowSize = neighborCount * 2 + 1;
  if (rows.length <= windowSize) return rows;

  if (focusIndex < 0 || focusIndex >= rows.length) {
    return rows.slice(0, windowSize);
  }

  let start = focusIndex - neighborCount;
  let end = focusIndex + neighborCount + 1;

  if (start < 0) {
    start = 0;
    end = windowSize;
  } else if (end > rows.length) {
    end = rows.length;
    start = rows.length - windowSize;
  }

  return rows.slice(start, end);
}

export type OverviewTeamMetric = {
  teamId: string;
  teamPublicId: string | null;
  teamName: string;
  ownerName: string;
  logoUrl: string | null;
  value: number;
};

export function rankByPointsFor(
  rows: LeagueStandingsRow[],
  limit = 1,
): OverviewTeamMetric[] {
  return rows
    .filter((row) => row.claimed && row.teamId)
    .toSorted((a, b) => b.pointsFor - a.pointsFor || a.teamName.localeCompare(b.teamName))
    .slice(0, limit)
    .map((row) => ({
      teamId: row.teamId!,
      teamPublicId: row.teamPublicId,
      teamName: row.teamName,
      ownerName: row.ownerName,
      logoUrl: row.logoUrl,
      value: row.pointsFor,
    }));
}

export function rankByPointsAgainst(
  rows: LeagueStandingsRow[],
  limit = 1,
): OverviewTeamMetric[] {
  return rows
    .filter((row) => row.claimed && row.teamId)
    .toSorted(
      (a, b) =>
        b.pointsAgainst - a.pointsAgainst ||
        a.teamName.localeCompare(b.teamName),
    )
    .slice(0, limit)
    .map((row) => ({
      teamId: row.teamId!,
      teamPublicId: row.teamPublicId,
      teamName: row.teamName,
      ownerName: row.ownerName,
      logoUrl: row.logoUrl,
      value: row.pointsAgainst,
    }));
}

export type OverviewInefficiencyRow = OverviewTeamMetric & {
  pointsFor: number;
  optimumPointsFor: number;
};

/**
 * Lowest actual-vs-optimal %.
 * `value` is PF / OPF × 100 (e.g. 75 = started 75% of optimal).
 */
export function rankByInefficiency(
  rows: Array<{
    teamId: string;
    teamPublicId: string | null;
    teamName: string;
    ownerName: string;
    logoUrl: string | null;
    claimed: boolean;
    seasonPointsFor: number | null;
    seasonOptimumPointsFor: number | null;
  }>,
  limit = 1,
): OverviewInefficiencyRow[] {
  return rows
    .filter(
      (row) =>
        row.claimed &&
        row.seasonPointsFor != null &&
        row.seasonOptimumPointsFor != null &&
        row.seasonOptimumPointsFor > 0,
    )
    .map((row) => {
      const pointsFor = row.seasonPointsFor!;
      const optimumPointsFor = row.seasonOptimumPointsFor!;
      const efficiencyPct =
        Math.round((pointsFor / optimumPointsFor) * 1000) / 10;
      return {
        teamId: row.teamId,
        teamPublicId: row.teamPublicId,
        teamName: row.teamName,
        ownerName: row.ownerName,
        logoUrl: row.logoUrl,
        pointsFor,
        optimumPointsFor,
        value: efficiencyPct,
      };
    })
    .filter((row) => row.value < 100)
    .toSorted(
      (a, b) => a.value - b.value || a.teamName.localeCompare(b.teamName),
    )
    .slice(0, limit);
}

export type OverviewPositionLeader = {
  positionId: OverviewPositionId;
  label: string;
  teamId: string;
  teamPublicId: string | null;
  teamName: string;
  logoUrl: string | null;
  points: number;
};

export function buildSeasonPositionLeaders(
  teams: Array<{
    teamId: string;
    teamPublicId: string | null;
    teamName: string;
    logoUrl: string | null;
    claimed: boolean;
    byPosition: Record<string, number>;
  }>,
): OverviewPositionLeader[] {
  const leaders: OverviewPositionLeader[] = [];
  for (const positionId of OVERVIEW_POSITIONS) {
    let best: (typeof teams)[number] | null = null;
    let bestPts = Number.NEGATIVE_INFINITY;
    for (const team of teams) {
      if (!team.claimed) continue;
      const pts = team.byPosition[positionId];
      if (pts == null || !Number.isFinite(pts)) continue;
      if (
        pts > bestPts ||
        (pts === bestPts &&
          best != null &&
          team.teamName.localeCompare(best.teamName) < 0)
      ) {
        best = team;
        bestPts = pts;
      }
    }
    if (!best) continue;
    leaders.push({
      positionId,
      label:
        positionId === "QB"
          ? "Quarterback"
          : positionId === "RB"
            ? "Running back"
            : positionId === "WR"
              ? "Wide receiver"
              : "Tight end",
      teamId: best.teamId,
      teamPublicId: best.teamPublicId,
      teamName: best.teamName,
      logoUrl: best.logoUrl,
      points: Math.round(bestPts * 10) / 10,
    });
  }
  return leaders;
}
