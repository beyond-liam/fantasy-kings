import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { IDP_POSITION_IDS } from "@/lib/leagues/idp-positions";

/** Display order for league leaders / position stats columns. */
export const LEADER_POSITION_ORDER = [
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  ...IDP_POSITION_IDS,
  "K",
  "DEF",
] as const;

export type LeaderPositionId = (typeof LEADER_POSITION_ORDER)[number];

export type StarterSlotPoints = {
  slotPositionId: string;
  points: number;
};

export type LeaguePositionStatsRow = {
  id: string;
  rank: number;
  teamId: string;
  teamPublicId: string | null;
  teamName: string;
  ownerName: string;
  ownerUserId?: string | null;
  logoUrl: string | null;
  claimed: boolean;
  /**
   * Starter points by slot position id. Null values mean scored data is not
   * available yet (league not started / no weekly actuals).
   */
  byPosition: Record<string, number | null>;
  pointsFor: number | null;
  /** Season PF from finalized matchups (null when none). */
  seasonPointsFor: number | null;
  optimumPointsFor: number | null;
  /** Season OPF from persisted weekly team_week_stats (null until snapshots exist). */
  seasonOptimumPointsFor: number | null;
};

export function formatLeaderPositionLabel(positionId: string): string {
  return positionId;
}

/** Plain-English labels for column toggles and similar menus. */
export function formatLeaderPositionFullLabel(positionId: string): string {
  switch (positionId) {
    case "QB":
      return "Quarterback";
    case "RB":
      return "Running back";
    case "WR":
      return "Wide receiver";
    case "TE":
      return "Tight end";
    case "FLEX":
      return "Flex";
    case "CB":
      return "Cornerback";
    case "S":
      return "Safety";
    case "DT":
      return "Defensive tackle";
    case "DE":
      return "Defensive end";
    case "LB":
      return "Linebacker";
    case "K":
      return "Kicker";
    case "DEF":
      return "Defense";
    default:
      return formatLeaderPositionLabel(positionId);
  }
}

/** Starter position columns for a league, in leaders display order. */
export function getLeaderPositionColumns(
  rosterSlots: RosterSlotConfig[],
): string[] {
  const starterIds = new Set(
    rosterSlots
      .filter((slot) => slot.isStarter && slot.slotCount > 0)
      .map((slot) => slot.positionId)
      .filter((id) => id !== "BN" && id !== "IR" && id !== "TAXI"),
  );

  const ordered = LEADER_POSITION_ORDER.filter((id) => starterIds.has(id));
  const extras = [...starterIds]
    .filter((id) => !LEADER_POSITION_ORDER.includes(id as LeaderPositionId))
    .sort((a, b) => a.localeCompare(b));

  return [...ordered, ...extras];
}

export function emptyPositionPoints(
  positionColumns: string[],
): Record<string, number | null> {
  const byPosition: Record<string, number | null> = {};
  for (const positionId of positionColumns) {
    byPosition[positionId] = null;
  }
  return byPosition;
}

export function aggregateStarterPositionPoints(
  starters: StarterSlotPoints[],
  positionColumns: string[],
): { byPosition: Record<string, number>; pointsFor: number } {
  const byPosition: Record<string, number> = {};
  for (const positionId of positionColumns) {
    byPosition[positionId] = 0;
  }

  let pointsFor = 0;
  for (const starter of starters) {
    const pts = Number.isFinite(starter.points) ? starter.points : 0;
    pointsFor += pts;
    if (starter.slotPositionId in byPosition) {
      byPosition[starter.slotPositionId] =
        (byPosition[starter.slotPositionId] ?? 0) + pts;
    }
  }

  return { byPosition, pointsFor };
}

export function buildLeaguePositionStatsRows(
  teams: Array<{
    teamId: string;
    teamPublicId: string | null;
    teamName: string;
    ownerName: string;
    ownerUserId?: string | null;
    logoUrl: string | null;
    claimed: boolean;
    starters: StarterSlotPoints[];
    optimumPointsFor: number | null;
  }>,
  positionColumns: string[],
  options?: { scoresAvailable?: boolean },
): LeaguePositionStatsRow[] {
  const scoresAvailable = options?.scoresAvailable ?? true;

  const rows = teams.map((team) => {
    if (!scoresAvailable) {
      return {
        id: team.teamId,
        rank: 0,
        teamId: team.teamId,
        teamPublicId: team.teamPublicId,
        teamName: team.teamName,
        ownerName: team.ownerName,
        ownerUserId: team.ownerUserId,
        logoUrl: team.logoUrl,
        claimed: team.claimed,
        byPosition: emptyPositionPoints(positionColumns),
        pointsFor: null,
        seasonPointsFor: null,
        optimumPointsFor: null,
        seasonOptimumPointsFor: null,
      };
    }

    const { byPosition, pointsFor } = aggregateStarterPositionPoints(
      team.starters,
      positionColumns,
    );
    return {
      id: team.teamId,
      rank: 0,
      teamId: team.teamId,
      teamPublicId: team.teamPublicId,
      teamName: team.teamName,
      ownerName: team.ownerName,
      ownerUserId: team.ownerUserId,
      logoUrl: team.logoUrl,
      claimed: team.claimed,
      byPosition,
      pointsFor,
      seasonPointsFor: null,
      optimumPointsFor: team.optimumPointsFor,
      seasonOptimumPointsFor: null,
    };
  });

  rows.sort((a, b) => {
    if (a.claimed !== b.claimed) {
      return a.claimed ? -1 : 1;
    }
    if (scoresAvailable) {
      const pfDiff = (b.pointsFor ?? 0) - (a.pointsFor ?? 0);
      if (pfDiff !== 0) {
        return pfDiff;
      }
      const optDiff = (b.optimumPointsFor ?? 0) - (a.optimumPointsFor ?? 0);
      if (optDiff !== 0) {
        return optDiff;
      }
    }
    return a.teamName.localeCompare(b.teamName);
  });

  return rows.map((row, index) => ({
    ...row,
    rank: row.claimed ? index + 1 : 0,
  }));
}

function roundPts(value: number) {
  return Math.round(value * 10) / 10;
}

export type SeasonTeamStats = {
  pointsFor: number;
  optimumPointsFor: number;
  byPosition: Record<string, number>;
};

/** Overlay season totals (summed weekly snapshots) and re-rank by season PF. */
export function applySeasonPositionStats(
  rows: LeaguePositionStatsRow[],
  positionColumns: string[],
  seasonByTeam: Map<string, number>,
  seasonStats: Map<string, SeasonTeamStats>,
): LeaguePositionStatsRow[] {
  const next = rows.map((row) => {
    const snap = seasonStats.get(row.teamId);
    const seasonPf = seasonByTeam.get(row.teamId) ?? null;
    if (!row.claimed) {
      return {
        ...row,
        byPosition: emptyPositionPoints(positionColumns),
        pointsFor: null,
        optimumPointsFor: null,
        seasonPointsFor: null,
        seasonOptimumPointsFor: null,
      };
    }
    if (!snap) {
      return {
        ...row,
        seasonPointsFor: seasonPf,
        seasonOptimumPointsFor: null,
      };
    }
    const byPosition = emptyPositionPoints(positionColumns);
    for (const col of positionColumns) {
      byPosition[col] = roundPts(snap.byPosition[col] ?? 0);
    }
    const pointsFor = roundPts(snap.pointsFor);
    const optimum = roundPts(snap.optimumPointsFor);
    return {
      ...row,
      byPosition,
      pointsFor,
      optimumPointsFor: optimum,
      seasonPointsFor: seasonPf ?? pointsFor,
      seasonOptimumPointsFor: optimum,
    };
  });

  next.sort((a, b) => {
    if (a.claimed !== b.claimed) {
      return a.claimed ? -1 : 1;
    }
    const pfDiff = (b.pointsFor ?? 0) - (a.pointsFor ?? 0);
    if (pfDiff !== 0) {
      return pfDiff;
    }
    const optDiff = (b.optimumPointsFor ?? 0) - (a.optimumPointsFor ?? 0);
    if (optDiff !== 0) {
      return optDiff;
    }
    return a.teamName.localeCompare(b.teamName);
  });

  return next.map((row, index) => ({
    ...row,
    rank: row.claimed ? index + 1 : 0,
  }));
}

export function leagueStatsHaveScores(rows: LeaguePositionStatsRow[]) {
  return rows.some((row) => row.claimed && row.pointsFor != null);
}
