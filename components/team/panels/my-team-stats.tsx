import type { ScheduleSettings } from "@/db/schema/league-seasons";
import { StatsChartsHydrator } from "@/components/team/stats-charts-hydrator";
import { loadMyTeamNflContext } from "@/components/team/panels/load-my-team-nfl-context";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring";
import { getTeamRosteredPlayerIds } from "@/lib/queries/roster";
import { getTeamRosterStatPlayers } from "@/lib/queries/team-player-stats";

export type MyTeamStatsPanelProps = {
  slug: string;
  teamId: string;
  seasonYear: number;
  schedule?: ScheduleSettings | null;
  scoringRules: ScoringRuleDefinition[];
  useChartsMock: boolean;
};

export async function MyTeamStatsPanel({
  slug,
  teamId,
  seasonYear,
  schedule,
  scoringRules,
  useChartsMock,
}: MyTeamStatsPanelProps) {
  const [{ fantasyWeek, nflSeason, nflState }, rosterIds] = await Promise.all([
    loadMyTeamNflContext({ seasonYear, schedule }),
    getTeamRosteredPlayerIds(teamId),
  ]);

  const seasonRows =
    rosterIds.length > 0
      ? await getTeamRosterStatPlayers({
          season: nflSeason,
          playerIds: rosterIds,
          scoringRules,
          nfl: nflState,
          schedule,
        }).catch(() => [])
      : [];

  const rosterIdSet = new Set(rosterIds);
  const players = seasonRows.filter((player) => rosterIdSet.has(player.id));

  const mockQuery = useChartsMock ? "&mock=1" : "";
  const chartsUrl = `/api/league/${slug}/team/stats-charts?teamId=${encodeURIComponent(teamId)}${mockQuery}`;

  return (
    <StatsChartsHydrator
      players={players}
      chartsUrl={chartsUrl}
      leagueSlug={slug}
      upcomingWeek={fantasyWeek}
    />
  );
}
