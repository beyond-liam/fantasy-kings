import "server-only";

import {
  getFinalMatchupsForSeason,
  type FinalMatchupRow,
} from "@/lib/leagues/matchups/finals";
import type { StarterPlayerSeasonPoints } from "@/lib/leagues/team-stats-charts";
import { getTeamSeasonStarterPoints } from "@/lib/leagues/team-stats-starter-points";
import {
  getSeasonOpfByTeamId,
  getTeamWeeklyScoreSnapshots,
} from "@/lib/leagues/team-week-stats";
import type { ScoringPreset } from "@/lib/leagues/scoring/types";

export type TeamWeekHistory = {
  finals: FinalMatchupRow[];
  seasonOpf: Awaited<ReturnType<typeof getSeasonOpfByTeamId>>;
  weekSnapshots: Awaited<ReturnType<typeof getTeamWeeklyScoreSnapshots>>;
  starterPoints: StarterPlayerSeasonPoints[];
};

/**
 * One seam for Team Stats / chart history: finals, OPF, week snapshots,
 * and snapshot-derived starter points. Failures surface as empty collections
 * so chart builders stay pure.
 */
export async function loadTeamWeekHistory(input: {
  leagueSeasonId: string;
  teamId: string;
  seasonYear: number;
  scoringPreset: string;
  scoringRules?: unknown;
}): Promise<TeamWeekHistory> {
  const [finals, seasonOpf, weekSnapshots, starterPoints] = await Promise.all([
    getFinalMatchupsForSeason(input.leagueSeasonId).catch(
      (): FinalMatchupRow[] => [],
    ),
    getSeasonOpfByTeamId(input.leagueSeasonId).catch(
      (): Awaited<ReturnType<typeof getSeasonOpfByTeamId>> => new Map(),
    ),
    getTeamWeeklyScoreSnapshots({
      leagueSeasonId: input.leagueSeasonId,
      teamId: input.teamId,
    }).catch(
      (): Awaited<ReturnType<typeof getTeamWeeklyScoreSnapshots>> => [],
    ),
    getTeamSeasonStarterPoints({
      leagueSeasonId: input.leagueSeasonId,
      teamId: input.teamId,
      seasonYear: input.seasonYear,
      scoringPreset: input.scoringPreset as ScoringPreset,
      scoringRules: input.scoringRules,
    }).catch((): StarterPlayerSeasonPoints[] => []),
  ]);

  return { finals, seasonOpf, weekSnapshots, starterPoints };
}
