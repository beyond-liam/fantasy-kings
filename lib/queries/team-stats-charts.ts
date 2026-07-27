import "server-only";

import { getFinalMatchupsForSeason } from "@/lib/leagues/matchups/finalize";
import { getLeaderPositionColumns } from "@/lib/leagues/league-position-stats";
import {
  buildOpponentByWeekFromFinals,
  buildPositionMix,
  buildTeamStatsKpis,
  buildWeeklyBenchWaste,
  buildWeeklyLuck,
  buildWeeklyPointsBand,
  type PositionMixPoint,
  type TeamStatsKpis,
  type WeeklyBenchWastePoint,
  type WeeklyLuckPoint,
  type WeeklyPointsBandPoint,
} from "@/lib/leagues/team-stats-charts";
import {
  getSeasonOpfByTeamId,
  getTeamWeeklyScoreSnapshots,
} from "@/lib/leagues/team-week-stats";
import { getLeagueBySlug, getLeagueSeason } from "@/lib/queries/leagues";

export type TeamStatsChartsData = {
  weeklyPoints: WeeklyPointsBandPoint[];
  positionMix: PositionMixPoint[];
  weeklyLuck: WeeklyLuckPoint[];
  benchWaste: WeeklyBenchWastePoint[];
  gamesFlippedByBench: number;
  kpis: TeamStatsKpis;
};

export async function getTeamStatsCharts(input: {
  leagueSlug: string;
  teamId: string;
}): Promise<TeamStatsChartsData | null> {
  const league = await getLeagueBySlug(input.leagueSlug);
  if (!league) {
    return null;
  }

  const season = await getLeagueSeason(league.id);
  if (!season) {
    return null;
  }

  const [finals, seasonOpf, weekSnapshots] = await Promise.all([
    getFinalMatchupsForSeason(season.id).catch(
      (): Awaited<ReturnType<typeof getFinalMatchupsForSeason>> => [],
    ),
    getSeasonOpfByTeamId(season.id).catch(
      (): Awaited<ReturnType<typeof getSeasonOpfByTeamId>> => new Map(),
    ),
    getTeamWeeklyScoreSnapshots({
      leagueSeasonId: season.id,
      teamId: input.teamId,
    }).catch(() => []),
  ]);

  const weeklyPoints = buildWeeklyPointsBand({
    teamId: input.teamId,
    finals,
  });

  const weeklyLuck = buildWeeklyLuck({
    teamId: input.teamId,
    finals,
  });

  const benchWaste = buildWeeklyBenchWaste({
    snapshots: weekSnapshots,
    opponentByWeek: buildOpponentByWeekFromFinals({
      teamId: input.teamId,
      finals,
    }),
  });

  const gamesFlippedByBench = benchWaste.filter(
    (row) => row.wouldHaveFlipped,
  ).length;

  const positionColumns = getLeaderPositionColumns(season.settings.rosterSlots);
  const leagueByPosition: Record<string, number> = {};
  for (const row of seasonOpf.values()) {
    for (const [pos, pts] of Object.entries(row.byPosition)) {
      leagueByPosition[pos] = (leagueByPosition[pos] ?? 0) + pts;
    }
  }

  const positionMix = buildPositionMix({
    teamByPosition: seasonOpf.get(input.teamId)?.byPosition ?? {},
    leagueByPosition,
    positionColumns,
  });

  const kpis = buildTeamStatsKpis({
    teamId: input.teamId,
    finals,
  });

  return {
    weeklyPoints,
    positionMix,
    weeklyLuck,
    benchWaste,
    gamesFlippedByBench,
    kpis,
  };
}
