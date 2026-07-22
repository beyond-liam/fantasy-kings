import type { RosterSlotConfig } from "@/db/schema/league-seasons";

/** Display order for league leaders / position stats columns. */
export const LEADER_POSITION_ORDER = [
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
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
  logoUrl: string | null;
  claimed: boolean;
  /**
   * Starter points by slot position id. Null values mean scored data is not
   * available yet (league not started / no weekly actuals).
   */
  byPosition: Record<string, number | null>;
  pointsFor: number | null;
  optimumPointsFor: number | null;
};

export function formatLeaderPositionLabel(positionId: string): string {
  if (positionId === "DEF") {
    return "D/ST";
  }
  return positionId;
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
        logoUrl: team.logoUrl,
        claimed: team.claimed,
        byPosition: emptyPositionPoints(positionColumns),
        pointsFor: null,
        optimumPointsFor: null,
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
      logoUrl: team.logoUrl,
      claimed: team.claimed,
      byPosition,
      pointsFor,
      optimumPointsFor: team.optimumPointsFor,
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
