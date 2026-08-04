import { LeagueHallOfFame } from "@/components/leagues/hall-of-fame/league-hall-of-fame";
import {
  standingsOwnerName,
  type LeagueStandingsMember,
} from "@/lib/leagues/standings";
import {
  emptyLeagueHallOfFame,
  loadLeagueHallOfFame,
} from "@/lib/queries/league-hall-of-fame";
import {
  getLeagueHomeStandingsBundle,
  loadHydratedPlayoffBracket,
  type LeagueHomeStandingsBundleInput,
} from "@/lib/queries/league-home-standings";

type LeagueHomeHofTabProps = {
  bundleInput: LeagueHomeStandingsBundleInput;
  leagueSlug: string;
  standingsTeams: LeagueStandingsMember[];
  divisionCount: number;
};

export async function LeagueHomeHofTab({
  bundleInput,
  leagueSlug,
  standingsTeams,
  divisionCount,
}: LeagueHomeHofTabProps) {
  if (bundleInput.leagueSeasonId == null || bundleInput.seasonYear == null) {
    return (
      <LeagueHallOfFame
        leagueSlug={leagueSlug}
        data={emptyLeagueHallOfFame()}
      />
    );
  }

  const { playoffStandings, playoffSettings, playoffTeamCount } =
    await getLeagueHomeStandingsBundle(bundleInput);

  const bracket = playoffSettings.enabled
    ? await loadHydratedPlayoffBracket({
        leagueSeasonId: bundleInput.leagueSeasonId,
        playoffStandings,
        playoffTeamCount,
        championshipWeek: bundleInput.championshipWeek,
        playoffSettings,
      })
    : null;

  const hofTeams = standingsTeams.map((team) => ({
    teamId: team.teamId!,
    teamPublicId: team.teamPublicId ?? null,
    teamName: team.teamName ?? "Team",
    ownerName: standingsOwnerName(team, "Unclaimed"),
    logoUrl: team.logoUrl ?? null,
    claimed: Boolean(team.userId && team.teamId),
    divisionId: team.divisionId ?? null,
  }));

  const hallOfFameData = await loadLeagueHallOfFame({
    leagueSeasonId: bundleInput.leagueSeasonId,
    seasonYear: bundleInput.seasonYear,
    teams: hofTeams.filter((t) => Boolean(t.teamId)),
    divisionCount,
    regularSeasonEndWeek: bundleInput.regularSeasonEndWeek,
    championTeamId: bracket?.champion?.teamId ?? null,
  }).catch(() => emptyLeagueHallOfFame());

  return (
    <LeagueHallOfFame leagueSlug={leagueSlug} data={hallOfFameData} />
  );
}
