import { TeamStatsSections } from "@/components/team/stats-sections";
import { withPlayerOpponent } from "@/components/team/panels/load-my-team-nfl-context";
import { getRosterEvaluationByModeMock } from "@/lib/leagues/roster-evaluation/mock";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring";
import { getTeamStatsChartsMock } from "@/lib/leagues/team-stats-charts-mock";
import type { TeamMatchup } from "@/lib/nfl/matchups";
import { getRankedPlayers } from "@/lib/queries/players";
import { getRosterEvaluationByMode } from "@/lib/queries/roster-evaluation";
import { getTeamRosteredPlayerIds } from "@/lib/queries/roster";
import { getTeamStatsCharts } from "@/lib/queries/team-stats-charts";
import { getNflState } from "@/lib/sleeper/api";

export type MyTeamStatsPanelProps = {
  slug: string;
  teamId: string;
  scoringRules: ScoringRuleDefinition[];
  useChartsMock: boolean;
};

export async function MyTeamStatsPanel({
  slug,
  teamId,
  scoringRules,
  useChartsMock,
}: MyTeamStatsPanelProps) {
  const [nflState, rosterIds] = await Promise.all([
    getNflState(),
    getTeamRosteredPlayerIds(teamId),
  ]);

  const nflSeason = nflState.season ?? String(new Date().getUTCFullYear());
  const nflWeek = Math.max(1, Number(nflState.week) || 1);
  const emptyOpponents = new Map<string, TeamMatchup>();

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
          upcomingWeek: nflWeek,
        }).catch(() => null),
  ]);

  const rosterIdSet = new Set(rosterIds);
  const scoredPlayers = seasonProjections
    .filter((player) => rosterIdSet.has(player.id))
    .map((player) => withPlayerOpponent(player, nflWeek, emptyOpponents));

  return (
    <TeamStatsSections
      players={scoredPlayers}
      leagueSlug={slug}
      charts={charts}
      upcomingWeek={nflWeek}
      rosterEvaluationByMode={rosterEvaluationByMode}
    />
  );
}
