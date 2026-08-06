import { PowerRankingsCard } from "@/components/leagues/power-rankings/power-rankings-card";
import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { resolveFantasyMatchupWeek } from "@/lib/leagues/matchup-week";
import { buildMockPowerRankingsOverview } from "@/lib/leagues/power-rankings/mock";
import type { LeagueStandingsMember } from "@/lib/leagues/standings";
import {
  getPowerRankingsOverview,
  type PowerRankingsOverview,
} from "@/lib/queries/power-rankings";

type LeagueHomePowerRankingsTabProps = {
  leagueSlug: string;
  leagueSeasonId: string | null;
  standingsTeams: LeagueStandingsMember[];
  seasonYear: number;
  championshipWeek: number;
  settings: LeagueSeasonSettings | null;
  scoringPreset: string | null;
  regularSeasonEndWeek: number;
  playoffTeamCount: number;
  teamCount: number;
  myTeamId: string | null;
  showFaabBudget: boolean;
  faabBudget: number | null;
  useMock?: boolean;
};

const EMPTY_OVERVIEW: PowerRankingsOverview = {
  draftRows: [],
  ticks: [],
  chartData: [],
  summaries: [],
  trendingUp: [],
  trendingDown: [],
  teamCount: 0,
  mySummary: null,
};

export async function LeagueHomePowerRankingsTab({
  leagueSlug,
  leagueSeasonId,
  standingsTeams,
  seasonYear,
  championshipWeek,
  settings,
  scoringPreset,
  regularSeasonEndWeek,
  playoffTeamCount,
  teamCount,
  myTeamId,
  showFaabBudget,
  faabBudget,
  useMock = false,
}: LeagueHomePowerRankingsTabProps) {
  const upcomingWeekPromise = resolveFantasyMatchupWeek({
    seasonYear,
    maxWeek: Math.max(1, championshipWeek),
  }).catch(() => ({ week: 1, weeks: [], calendarWeeks: [] }));

  const overviewPromise = useMock
    ? Promise.resolve(
        buildMockPowerRankingsOverview({
          standingsTeams,
          myTeamId,
        }),
      )
    : leagueSeasonId && settings && scoringPreset
      ? getPowerRankingsOverview({
          leagueSeasonId,
          seasonYear,
          standingsTeams,
          settings,
          scoringPreset,
          regularSeasonEndWeek,
          playoffTeamCount,
          teamCount,
          myTeamId,
          showFaabBudget,
          faabBudget,
        })
      : Promise.resolve(EMPTY_OVERVIEW);

  const [{ week: upcomingWeek }, overview] = await Promise.all([
    upcomingWeekPromise,
    overviewPromise,
  ]);

  return (
    <PowerRankingsCard
      leagueSlug={leagueSlug}
      standingsTeams={standingsTeams}
      upcomingWeek={upcomingWeek}
      draftRows={overview.draftRows}
      chartData={overview.chartData}
      summaries={overview.summaries}
      trendingUp={overview.trendingUp}
      trendingDown={overview.trendingDown}
      teamCount={overview.teamCount}
      myTeamId={myTeamId}
      mySummary={overview.mySummary}
    />
  );
}
