import "server-only";

import type { MyTeamNflContext } from "@/components/team/panels/load-my-team-nfl-context";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring";
import {
  getPlayerFantasyPoints,
  getWeekProjectedFantasyPoints,
} from "@/lib/queries/players";
import type { EnrichmentShellPlayer } from "@/lib/roster-enrichment/types";

export type RosterEnrichmentWeekData = {
  projectedById: Map<string, number | null>;
  actualById: Map<string, number | null>;
};

function warnSubqueryFailure(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[loadRosterEnrichmentWeek] ${scope} failed: ${message}`);
}

/**
 * Week-dependent roster enrichment: projections and scored stats for the viewed NFL week.
 */
export async function loadRosterEnrichmentWeek(input: {
  scoringRules: ScoringRuleDefinition[];
  players: EnrichmentShellPlayer[];
  nflContext: MyTeamNflContext;
}): Promise<RosterEnrichmentWeekData> {
  const { scoringRules, players, nflContext } = input;
  const playerIds = players.map((player) => player.id);
  const { nflWeek, nflSeason, nflSeasonType } = nflContext;

  if (playerIds.length === 0) {
    return {
      projectedById: new Map(),
      actualById: new Map(),
    };
  }

  const [projectedById, actualById] = await Promise.all([
    getWeekProjectedFantasyPoints({
      season: nflSeason,
      week: nflWeek,
      seasonType: nflSeasonType,
      scoringRules,
      playerIds,
    }).catch((error) => {
      warnSubqueryFailure("projections", error);
      return new Map<string, number | null>();
    }),
    getPlayerFantasyPoints({
      season: nflSeason,
      week: nflWeek,
      seasonType: nflSeasonType,
      kind: "stats",
      scoringRules,
      playerIds,
    }).catch((error) => {
      warnSubqueryFailure("week points", error);
      return new Map<string, number | null>();
    }),
  ]);

  return { projectedById, actualById };
}
