import { PowerRankingsCard } from "@/components/leagues/power-rankings/power-rankings-card";
import { resolveFantasyMatchupWeek } from "@/lib/leagues/matchup-week";
import type { LeagueStandingsMember } from "@/lib/leagues/standings";

type LeagueHomePowerRankingsTabProps = {
  leagueSlug: string;
  standingsTeams: LeagueStandingsMember[];
  seasonYear: number;
  championshipWeek: number;
};

export async function LeagueHomePowerRankingsTab({
  leagueSlug,
  standingsTeams,
  seasonYear,
  championshipWeek,
}: LeagueHomePowerRankingsTabProps) {
  const { week: upcomingWeek } = await resolveFantasyMatchupWeek({
    seasonYear,
    maxWeek: Math.max(1, championshipWeek),
  }).catch(() => ({ week: 1, weeks: [], calendarWeeks: [] }));

  return (
    <PowerRankingsCard
      leagueSlug={leagueSlug}
      standingsTeams={standingsTeams}
      upcomingWeek={upcomingWeek}
    />
  );
}
