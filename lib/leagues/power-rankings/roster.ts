import { weightedRosterStrength } from "@/lib/leagues/draft/grades";
import {
  buildEmptyPowerRankingRows,
  buildPowerRankingRowsFromStrength,
} from "@/lib/leagues/power-rankings/rows";
import type { PowerRankingTeamRow } from "@/lib/leagues/power-rankings/types";
import type { LeagueStandingsMember } from "@/lib/leagues/standings";

/**
 * Current-roster power rankings from league-scored projections.
 * Same weighting as draft grades: top starterSlots full, rest ×0.35.
 */
export function buildRosterPowerRankingRows(input: {
  teams: LeagueStandingsMember[];
  /** Fantasy pts per player id (week or season projections). */
  fantasyPtsByPlayerId: Map<string, number>;
  /** Rostered player ids per team. */
  playerIdsByTeamId: Map<string, string[]>;
  starterSlots: number;
}): PowerRankingTeamRow[] {
  const strengthByTeamId = new Map<string, number>();
  for (const [teamId, playerIds] of input.playerIdsByTeamId) {
    const pts = playerIds.map(
      (playerId) => input.fantasyPtsByPlayerId.get(playerId) ?? 0,
    );
    strengthByTeamId.set(
      teamId,
      weightedRosterStrength(pts, input.starterSlots),
    );
  }

  if (strengthByTeamId.size === 0) {
    return buildEmptyPowerRankingRows(input.teams);
  }

  return buildPowerRankingRowsFromStrength({
    teams: input.teams,
    strengthByTeamId,
  });
}
