import type { ScheduleSettings } from "@/db/schema/league-seasons";
import { TeamStatsSections } from "@/components/team/stats-sections";
import {
  loadMyTeamNflContext,
  withPlayerOpponent,
} from "@/components/team/panels/load-my-team-nfl-context";
import { getRosterEvaluationByModeMock } from "@/lib/leagues/roster-evaluation/mock";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring";
import { getTeamStatsChartsMock } from "@/lib/leagues/team-stats-charts-mock";
import { getRankedPlayers } from "@/lib/queries/players";
import { getRosterEvaluationByMode } from "@/lib/queries/roster-evaluation";
import { getTeamRosteredPlayerIds } from "@/lib/queries/roster";
import { getTeamStatsCharts } from "@/lib/queries/team-stats-charts";

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
  const [
    { fantasyWeek, nflWeek, nflSeason, nflSeasonType, opponentsByTeam },
    rosterIds,
  ] = await Promise.all([
    loadMyTeamNflContext({ seasonYear, schedule }),
    getTeamRosteredPlayerIds(teamId),
  ]);

  const [seasonProjections, charts, rosterEvaluationByMode] = await Promise.all([
    rosterIds.length > 0
      ? getRankedPlayers({
          season: nflSeason,
          week: 0,
          kind: "projection",
          scoringRules,
          playerIds: rosterIds,
        }).catch(() => [])
      : Promise.resolve([]),
    useChartsMock
      ? Promise.resolve(getTeamStatsChartsMock())
      : getTeamStatsCharts({
          leagueSlug: slug,
          teamId,
        }).catch(() => null),
    useChartsMock
      ? Promise.resolve(getRosterEvaluationByModeMock())
      : getRosterEvaluationByMode({
          leagueSlug: slug,
          teamId,
          upcomingWeek: fantasyWeek,
        }).catch(() => null),
  ]);

  const rosterIdSet = new Set(rosterIds);
  const scoredPlayers = seasonProjections
    .filter((player) => rosterIdSet.has(player.id))
    .map((player) =>
      withPlayerOpponent(player, nflWeek, opponentsByTeam, {
        seasonYear,
        seasonType: nflSeasonType,
      }),
    );

  return (
    <TeamStatsSections
      players={scoredPlayers}
      leagueSlug={slug}
      charts={charts}
      upcomingWeek={fantasyWeek}
      rosterEvaluationByMode={rosterEvaluationByMode}
    />
  );
}
