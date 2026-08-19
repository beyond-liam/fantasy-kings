import "server-only";

import type { ScheduleSettings } from "@/db/schema/league-seasons";
import { loadMyTeamNflContext } from "@/components/team/panels/load-my-team-nfl-context";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring";
import { getRankedPlayers } from "@/lib/queries/players";

/** Week stat bag for scoring breakdown — loaded on demand, not on roster SSR. */
export async function loadPlayerWeekStatsForBreakdown(input: {
  seasonYear: number;
  schedule?: ScheduleSettings | null;
  fantasyWeek: number;
  playerId: string;
  scoringRules: ScoringRuleDefinition[];
}): Promise<Record<string, number | null>> {
  const nflContext = await loadMyTeamNflContext({
    seasonYear: input.seasonYear,
    schedule: input.schedule,
    fantasyWeek: input.fantasyWeek,
  });

  const rows = await getRankedPlayers({
    season: nflContext.nflSeason,
    week: nflContext.nflWeek,
    seasonType: nflContext.nflSeasonType,
    kind: "stats",
    scoringRules: input.scoringRules,
    playerIds: [input.playerId],
    preserveStats: true,
  });

  return rows[0]?.stats ?? {};
}
