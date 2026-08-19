import "server-only";

import type { ScheduleSettings } from "@/db/schema/league-seasons";
import type { MyTeamNflContext } from "@/components/team/panels/load-my-team-nfl-context";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring";
import { getPlayerRosterRatesMap } from "@/lib/queries/player-roster-rates";
import { getPositionalSosTableResult } from "@/lib/queries/positional-sos";
import {
  getRosterTableStatMap,
  type RosterTableStat,
} from "@/lib/queries/team-player-stats";
import type { PositionalSosTable } from "@/lib/players/matchup-difficulty";
import type { PlayerRosterRates } from "@/lib/queries/player-roster-rates";
import type { EnrichmentShellPlayer } from "@/lib/roster-enrichment/types";

export type RosterEnrichmentStableData = {
  rosterRates: Map<string, PlayerRosterRates>;
  tableStats: Map<string, RosterTableStat>;
  sos: PositionalSosTable;
};

function warnSubqueryFailure(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[loadRosterEnrichmentStable] ${scope} failed: ${message}`);
}

/**
 * Week-invariant roster enrichment: ownership, season table stats/rank, positional SOS.
 * Safe to cache or reuse when only the viewed fantasy week changes.
 */
export async function loadRosterEnrichmentStable(input: {
  schedule?: ScheduleSettings | null;
  scoringRules: ScoringRuleDefinition[];
  players: EnrichmentShellPlayer[];
  nflContext: MyTeamNflContext;
}): Promise<RosterEnrichmentStableData> {
  const { schedule, scoringRules, players, nflContext } = input;
  const playerIds = players.map((player) => player.id);
  const { nflSeason, nflState } = nflContext;

  if (playerIds.length === 0) {
    return {
      rosterRates: new Map(),
      tableStats: new Map(),
      sos: new Map(),
    };
  }

  const [rosterRates, tableStats, sosResult] = await Promise.all([
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
    getPositionalSosTableResult({
      season: nflSeason,
      positionIds: players.map((player) => player.primaryPositionId),
      rules: scoringRules,
    }),
  ]);

  const sos = sosResult.ok ? sosResult.table : new Map();
  if (!sosResult.ok) {
    console.warn(
      `[loadRosterEnrichmentStable] positional SOS unavailable for season=${nflSeason} positions=${players.length}: ${sosResult.error.message}`,
    );
  }

  return { rosterRates, tableStats, sos };
}
