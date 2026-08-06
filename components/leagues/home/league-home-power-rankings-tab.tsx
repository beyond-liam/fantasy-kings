import { PowerRankingsCard } from "@/components/leagues/power-rankings/power-rankings-card";
import { resolveFantasyMatchupWeek } from "@/lib/leagues/matchup-week";
import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import type { LeagueStandingsMember } from "@/lib/leagues/standings";
import { getDraftPowerRankingRows } from "@/lib/queries/power-rankings";

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
}: LeagueHomePowerRankingsTabProps) {
  const [{ week: upcomingWeek }, draftRows] = await Promise.all([
    resolveFantasyMatchupWeek({
      seasonYear,
      maxWeek: Math.max(1, championshipWeek),
    }).catch(() => ({ week: 1, weeks: [], calendarWeeks: [] })),
    leagueSeasonId && settings && scoringPreset
      ? getDraftPowerRankingRows({
          leagueSeasonId,
          seasonYear,
          standingsTeams,
          settings,
          scoringPreset,
          regularSeasonEndWeek,
          playoffTeamCount,
        })
      : Promise.resolve([]),
  ]);

  return (
    <PowerRankingsCard
      leagueSlug={leagueSlug}
      standingsTeams={standingsTeams}
      upcomingWeek={upcomingWeek}
      draftRows={draftRows}
    />
  );
}
