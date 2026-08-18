import type { ScheduleSettings } from "@/db/schema/league-seasons";
import { TeamStatsSections } from "@/components/team/stats-sections";
import {
  loadMyTeamNflContext,
  withPlayerOpponent,
} from "@/components/team/panels/load-my-team-nfl-context";
import { getRosterEvaluationByModeMock } from "@/lib/leagues/roster-evaluation/mock";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring";
import { getTeamStatsChartsMock } from "@/lib/leagues/team-stats-charts-mock";
import { getRosterEvaluationByMode } from "@/lib/queries/roster-evaluation";
import { getTeamRosteredPlayerIds } from "@/lib/queries/roster";
import { getTeamRosterStatPlayers } from "@/lib/queries/team-player-stats";
import { getTeamStatsCharts } from "@/lib/queries/team-stats-charts";
import { getPositionalSosTable } from "@/lib/queries/positional-sos";

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
    { fantasyWeek, nflWeek, nflSeason, nflSeasonType, opponentsByTeam, nflState },
    rosterIds,
  ] = await Promise.all([
    loadMyTeamNflContext({ seasonYear, schedule }),
    getTeamRosteredPlayerIds(teamId),
  ]);

  const seasonRowsPromise =
    rosterIds.length > 0
      ? getTeamRosterStatPlayers({
          season: nflSeason,
          playerIds: rosterIds,
          scoringRules,
          nfl: nflState,
          schedule,
        }).catch(() => [])
      : Promise.resolve([]);

  const [seasonRows, charts, rosterEvaluationByMode, sos] = await Promise.all([
    seasonRowsPromise,
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
    seasonRowsPromise.then((rows) =>
      getPositionalSosTable({
        season: nflSeason,
        positionIds: rows.map((player) => player.primaryPositionId),
        rules: scoringRules,
      }),
    ),
  ]);

  const rosterIdSet = new Set(rosterIds);
  const scoredPlayers = seasonRows
    .filter((player) => rosterIdSet.has(player.id))
    .map((player) =>
      withPlayerOpponent(player, nflWeek, opponentsByTeam, {
        seasonYear,
        seasonType: nflSeasonType,
        sos,
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
