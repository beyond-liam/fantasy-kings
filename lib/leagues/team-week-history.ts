import "server-only";

import {
  getLeagueRollupMatchups,
  type FinalMatchupRow,
} from "@/lib/leagues/matchups/finals";
import type { ScheduleSettings } from "@/db/schema/league-seasons";
import type { StarterPlayerSeasonPoints } from "@/lib/leagues/team-stats-charts";
import { getTeamSeasonStarterPoints } from "@/lib/leagues/team-stats-starter-points";
import {
  getSeasonOpfByTeamId,
  getTeamWeeklyScoreSnapshots,
} from "@/lib/leagues/team-week-stats";
import type { ScoringPreset } from "@/lib/leagues/scoring/types";
import { getGameWeekCloseState } from "@/lib/nfl/current-week-board";
import { excludeUnfinalizedGameWeek } from "@/lib/nfl/game-week";

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
  schedule?: ScheduleSettings | null;
}): Promise<TeamWeekHistory> {
  const closePromise = getGameWeekCloseState(input.schedule);
  const [finals, seasonOpf, weekSnapshots, starterPoints] = await Promise.all([
    getLeagueRollupMatchups(input.leagueSeasonId, input.schedule).catch(
      (): FinalMatchupRow[] => [],
    ),
    closePromise.then((close) =>
      getSeasonOpfByTeamId(input.leagueSeasonId, {
        excludeWeek: close.weekFinalized ? null : close.fantasyWeek,
      }).catch(
        (): Awaited<ReturnType<typeof getSeasonOpfByTeamId>> => new Map(),
      ),
    ),
    closePromise.then(async (close) => {
      const rows = await getTeamWeeklyScoreSnapshots({
        leagueSeasonId: input.leagueSeasonId,
        teamId: input.teamId,
      }).catch(
        (): Awaited<ReturnType<typeof getTeamWeeklyScoreSnapshots>> => [],
      );
      return excludeUnfinalizedGameWeek(
        rows,
        close.fantasyWeek,
        close.weekFinalized,
      );
    }),
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
