import type { TeamRosterPlayer } from "@/lib/leagues/roster-fill";
import type { RankedPlayerRow } from "@/lib/queries/players";

import type {
  RosterPlayerEnrichment,
  StatsPlayerEnrichment,
} from "@/lib/roster-enrichment/types";

export function applyRosterPlayerEnrichment(
  shell: TeamRosterPlayer[],
  enrichmentByPlayerId: Record<string, RosterPlayerEnrichment>,
): TeamRosterPlayer[] {
  return shell.map((player) => {
    const enrichment = enrichmentByPlayerId[player.id];
    if (!enrichment) return player;
    return {
      ...player,
      ownedPct: enrichment.ownedPct,
      startPct: enrichment.startPct,
      projectedPts: enrichment.projectedPts,
      actualPts: enrichment.actualPts,
      weekStats: enrichment.weekStats,
      positionRank: enrichment.positionRank,
      fantasyPts: enrichment.fantasyPts,
      avgPts: enrichment.avgPts,
      opponent: enrichment.opponent ?? player.opponent,
    };
  });
}

export function applyStatsPlayerEnrichment(
  shell: RankedPlayerRow[],
  enrichmentByPlayerId: Record<string, StatsPlayerEnrichment>,
): RankedPlayerRow[] {
  return shell.map((player) => {
    const enrichment = enrichmentByPlayerId[player.id];
    if (!enrichment) return player;
    return {
      ...player,
      opponent: enrichment.opponent ?? player.opponent,
    };
  });
}
