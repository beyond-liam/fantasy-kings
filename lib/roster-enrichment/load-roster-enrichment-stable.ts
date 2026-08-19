import "server-only";

import type { ScheduleSettings } from "@/db/schema/league-seasons";
import type { MyTeamNflContext } from "@/components/team/panels/load-my-team-nfl-context";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring";
import { getPlayerRosterRatesMap } from "@/lib/queries/player-roster-rates";
import {
  getRosterTableStatMap,
  type RosterTableStat,
} from "@/lib/queries/team-player-stats";
import type { PlayerRosterRates } from "@/lib/queries/player-roster-rates";
import type { EnrichmentShellPlayer } from "@/lib/roster-enrichment/types";
import {
  getCachedRosterEnrichmentStable,
  stableEnrichmentCacheKey,
} from "@/lib/roster-enrichment/stable-enrichment-cache";

export type RosterEnrichmentStableData = {
  rosterRates: Map<string, PlayerRosterRates>;
  tableStats: Map<string, RosterTableStat>;
};

function warnSubqueryFailure(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[loadRosterEnrichmentStable] ${scope} failed: ${message}`);
}

async function loadRosterEnrichmentStableUncached(input: {
  schedule?: ScheduleSettings | null;
  scoringRules: ScoringRuleDefinition[];
  players: EnrichmentShellPlayer[];
  nflContext: MyTeamNflContext;
}): Promise<RosterEnrichmentStableData> {
  const { schedule, scoringRules, players, nflContext } = input;
  const playerIds = players.map((player) => player.id);
  const { nflSeason, nflState } = nflContext;

  const [rosterRates, tableStats] = await Promise.all([
    getPlayerRosterRatesMap(playerIds).catch((error) => {
      warnSubqueryFailure("ownership rates", error);
      return new Map<string, PlayerRosterRates>();
    }),
    getRosterTableStatMap({
      season: nflSeason,
      playerIds,
      scoringRules,
      nfl: nflState,
      schedule,
    }).catch((error) => {
      warnSubqueryFailure("table stats", error);
      return new Map<string, RosterTableStat>();
    }),
  ]);

  return { rosterRates, tableStats };
}

/**
 * Week-invariant roster enrichment: ownership and season table stats/rank.
 * Positional SoS is loaded client-side on demand.
 */
export async function loadRosterEnrichmentStable(input: {
  schedule?: ScheduleSettings | null;
  scoringRules: ScoringRuleDefinition[];
  players: EnrichmentShellPlayer[];
  nflContext: MyTeamNflContext;
}): Promise<RosterEnrichmentStableData> {
  const playerIds = input.players.map((player) => player.id);
  if (playerIds.length === 0) {
    return {
      rosterRates: new Map(),
      tableStats: new Map(),
    };
  }

  const key = stableEnrichmentCacheKey({
    nflSeason: input.nflContext.nflSeason,
    playerIds,
    scoringRules: input.scoringRules,
  });

  return getCachedRosterEnrichmentStable(key, () =>
    loadRosterEnrichmentStableUncached(input),
  );
}
