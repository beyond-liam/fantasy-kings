import "server-only";

import type { ScheduleSettings } from "@/db/schema/league-seasons";
import { withPlayerOpponent } from "@/components/team/panels/load-my-team-nfl-context";
import {
  loadMyTeamNflContext,
  type MyTeamNflContext,
} from "@/components/team/panels/load-my-team-nfl-context";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring";
import { loadRosterEnrichmentStable } from "@/lib/roster-enrichment/load-roster-enrichment-stable";
import { loadRosterEnrichmentWeek } from "@/lib/roster-enrichment/load-roster-enrichment-week";
import {
  ROSTER_ENRICHMENT_VERSION,
  type EnrichmentShellPlayer,
  type RosterEnrichmentPayload,
  type RosterPlayerEnrichment,
} from "@/lib/roster-enrichment/types";
import { emptyRosterEnrichmentSuccess } from "@/lib/roster-enrichment/contracts";

export type LoadRosterEnrichmentInput = {
  seasonYear: number;
  schedule?: ScheduleSettings | null;
  scoringRules: ScoringRuleDefinition[];
  fantasyWeek: number;
  players: EnrichmentShellPlayer[];
  nflContext?: MyTeamNflContext;
};

export async function loadRosterEnrichment(
  input: LoadRosterEnrichmentInput,
): Promise<RosterEnrichmentPayload> {
  const { seasonYear, schedule, scoringRules, fantasyWeek, players, nflContext } =
    input;
  const playerIds = players.map((player) => player.id);

  if (playerIds.length === 0) {
    return emptyRosterEnrichmentSuccess();
  }

  try {
    const nfl =
      nflContext ??
      (await loadMyTeamNflContext({
        seasonYear,
        schedule,
        fantasyWeek,
      }));
    const { nflWeek, nflSeasonType, opponentsByTeam } = nfl;

    const [stable, weekData] = await Promise.all([
      loadRosterEnrichmentStable({
        schedule,
        scoringRules,
        players,
        nflContext: nfl,
      }),
      loadRosterEnrichmentWeek({
        scoringRules,
        players,
        nflContext: nfl,
      }),
    ]);

    const { rosterRates, tableStats, sos } = stable;
    const { projectedById, actualById, weekStatsById } = weekData;

    const enrichmentByPlayerId: Record<string, RosterPlayerEnrichment> = {};
    for (const player of players) {
      const rates = rosterRates.get(player.id);
      const tableStat = tableStats.get(player.id);
      const enriched = withPlayerOpponent(
        {
          ...player,
          actualPts: actualById.get(player.id) ?? null,
          projectedPts: projectedById.get(player.id) ?? null,
          weekStats: weekStatsById.get(player.id),
          ownedPct: rates?.ownedPct ?? null,
          startPct: rates?.startPct ?? null,
          positionRank: tableStat?.positionRank ?? null,
          fantasyPts: tableStat?.fantasyPts ?? null,
          avgPts: tableStat?.avgPts ?? null,
        },
        nflWeek,
        opponentsByTeam,
        {
          seasonYear,
          seasonType: nflSeasonType,
          sos,
        },
      );

      enrichmentByPlayerId[player.id] = {
        ownedPct: enriched.ownedPct ?? null,
        startPct: enriched.startPct ?? null,
        projectedPts: enriched.projectedPts ?? null,
        actualPts: enriched.actualPts ?? null,
        weekStats: enriched.weekStats,
        positionRank: enriched.positionRank ?? null,
        fantasyPts: enriched.fantasyPts ?? null,
        avgPts: enriched.avgPts ?? null,
        opponent: enriched.opponent ?? null,
      };
    }

    return {
      ok: true,
      version: ROSTER_ENRICHMENT_VERSION,
      enrichmentByPlayerId,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Roster enrichment failed",
    };
  }
}
