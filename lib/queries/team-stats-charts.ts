import "server-only";

import { getLeaderPositionColumns } from "@/lib/leagues/league-position-stats";
import {
  buildOpponentByWeekFromFinals,
  buildPositionMix,
  buildScoringConcentration,
  buildTeamStatsKpis,
  buildWeeklyBenchWaste,
  buildWeeklyLuck,
  buildWeeklyPointsBand,
  type PositionMixPoint,
  type ScoringConcentration,
  type TeamStatsKpis,
  type WeeklyBenchWastePoint,
  type WeeklyLuckPoint,
  type WeeklyPointsBandPoint,
} from "@/lib/leagues/team-stats-charts";
import { loadTeamWeekHistory } from "@/lib/leagues/team-week-history";
import { getLeagueBySlug, getLeagueSeason } from "@/lib/queries/leagues";

export type TeamStatsChartsData = {
  weeklyPoints: WeeklyPointsBandPoint[];
  positionMix: PositionMixPoint[];
  weeklyLuck: WeeklyLuckPoint[];
  benchWaste: WeeklyBenchWastePoint[];
  gamesFlippedByBench: number;
  scoringConcentration: ScoringConcentration;
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

  const { finals, seasonOpf, weekSnapshots, starterPoints } =
    await loadTeamWeekHistory({
      leagueSeasonId: season.id,
      teamId: input.teamId,
      seasonYear: season.seasonYear,
      scoringPreset: season.scoringPreset,
      scoringRules: season.settings.scoringRules,
      schedule: season.settings.schedule,
    });

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

  const scoringConcentration = buildScoringConcentration({
    players: starterPoints,
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
    scoringConcentration,
    kpis,
  };
}
