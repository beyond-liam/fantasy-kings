import { IDP_POSITION_IDS } from "@/lib/leagues/idp-positions";
import { formatLeaderPositionFullLabel } from "@/lib/leagues/league-position-stats";
import type { LeagueStandingsRow } from "@/lib/leagues/standings";
import { expandFinalMatchupRowsWithOpponent } from "@/lib/leagues/matchups/expand-finals";

const OVERVIEW_POSITIONS = [
  "QB",
  "RB",
  "WR",
  "TE",
  ...IDP_POSITION_IDS,
] as const;

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
  ownerUserId?: string | null;
  logoUrl: string | null;
  value: number;
};

export function rankByPointsFor(
  rows: LeagueStandingsRow[],
  limit = 1,
): OverviewTeamMetric[] {
  return rows
    .filter((row) => row.claimed && row.teamId && row.pointsFor > 0)
    .toSorted((a, b) => b.pointsFor - a.pointsFor || a.teamName.localeCompare(b.teamName))
    .slice(0, limit)
    .map((row) => ({
      teamId: row.teamId!,
      teamPublicId: row.teamPublicId,
      teamName: row.teamName,
      ownerName: row.ownerName,
      ownerUserId: row.ownerUserId,
      logoUrl: row.logoUrl,
      value: row.pointsFor,
    }));
}

export function rankByPointsAgainst(
  rows: LeagueStandingsRow[],
  limit = 1,
): OverviewTeamMetric[] {
  return rows
    .filter((row) => row.claimed && row.teamId && row.pointsAgainst > 0)
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
      ownerUserId: row.ownerUserId,
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
    ownerUserId?: string | null;
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
        ownerUserId: row.ownerUserId,
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
      label: formatLeaderPositionFullLabel(positionId),
      teamId: best.teamId,
      teamPublicId: best.teamPublicId,
      teamName: best.teamName,
      logoUrl: best.logoUrl,
      points: Math.round(bestPts * 10) / 10,
    });
  }
  return leaders;
}

export type OverviewWeeklyResult = {
  teamId: string;
  pointsFor: number;
  won: boolean;
  lost: boolean;
};

export type OverviewWeeklyRoast = {
  week: number;
  biggestScorer: OverviewTeamMetric | null;
  luckiestWinner: OverviewTeamMetric | null;
  underachiever: OverviewTeamMetric | null;
};

function metricFromTeam(
  team: {
    teamId: string;
    teamPublicId: string | null;
    teamName: string;
    ownerName: string;
    ownerUserId?: string | null;
    logoUrl: string | null;
  },
  value: number,
): OverviewTeamMetric {
  return {
    teamId: team.teamId,
    teamPublicId: team.teamPublicId,
    teamName: team.teamName,
    ownerName: team.ownerName,
    ownerUserId: team.ownerUserId,
    logoUrl: team.logoUrl,
    value: Math.round(value * 10) / 10,
  };
}

/**
 * Weekly roast plaques for the latest finalized fantasy week.
 * Underachiever = most bench points left (OPF − PF) among losers.
 */
export function pickWeeklyRoast(input: {
  week: number;
  teams: Array<{
    teamId: string;
    teamPublicId: string | null;
    teamName: string;
    ownerName: string;
    ownerUserId?: string | null;
    logoUrl: string | null;
  }>;
  results: OverviewWeeklyResult[];
  /** Bench points left that week (typically max(0, OPF − PF)). */
  benchLeftByTeamId: Map<string, number>;
}): OverviewWeeklyRoast {
  const byId = new Map(input.teams.map((team) => [team.teamId, team]));
  const scored = input.results.filter((row) => byId.has(row.teamId));

  let biggestScorer: OverviewTeamMetric | null = null;
  let luckiestWinner: OverviewTeamMetric | null = null;
  let underachiever: OverviewTeamMetric | null = null;

  for (const row of scored) {
    const team = byId.get(row.teamId)!;
    if (
      !biggestScorer ||
      row.pointsFor > biggestScorer.value ||
      (row.pointsFor === biggestScorer.value &&
        team.teamName.localeCompare(biggestScorer.teamName) < 0)
    ) {
      biggestScorer = metricFromTeam(team, row.pointsFor);
    }
    if (row.won) {
      if (
        !luckiestWinner ||
        row.pointsFor < luckiestWinner.value ||
        (row.pointsFor === luckiestWinner.value &&
          team.teamName.localeCompare(luckiestWinner.teamName) < 0)
      ) {
        luckiestWinner = metricFromTeam(team, row.pointsFor);
      }
    }
    if (row.lost) {
      const benchLeft = input.benchLeftByTeamId.get(row.teamId) ?? 0;
      if (benchLeft <= 0) continue;
      if (
        !underachiever ||
        benchLeft > underachiever.value ||
        (benchLeft === underachiever.value &&
          team.teamName.localeCompare(underachiever.teamName) < 0)
      ) {
        underachiever = metricFromTeam(team, benchLeft);
      }
    }
  }

  return {
    week: input.week,
    biggestScorer,
    luckiestWinner,
    underachiever,
  };
}

/** Latest week that has at least one final with scores. */
export function latestScoredWeek(
  finals: Array<{ week: number; homePts: number | null; awayPts: number | null }>,
): number | null {
  let latest: number | null = null;
  for (const row of finals) {
    if (row.homePts == null || row.awayPts == null) continue;
    if (latest == null || row.week > latest) latest = row.week;
  }
  return latest;
}

export function weeklyResultsFromFinals(
  finals: Array<{
    week: number;
    homeTeamId: string;
    awayTeamId: string;
    homePts: number | null;
    awayPts: number | null;
  }>,
  week: number,
): OverviewWeeklyResult[] {
  const results: OverviewWeeklyResult[] = [];
  const expandedRows = expandFinalMatchupRowsWithOpponent(finals);
  for (const row of expandedRows) {
    if (row.week !== week) continue;
    results.push({
      teamId: row.teamId,
      pointsFor: row.pts,
      won: row.pts > row.opponentPts,
      lost: row.pts < row.opponentPts,
    });
  }
  return results;
}
