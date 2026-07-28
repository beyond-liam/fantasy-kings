import { LeagueStandingsTable } from "@/components/leagues/standings/standings-table";
import {
  getLeagueHomeStandingsBundle,
  type LeagueHomeStandingsBundleInput,
} from "@/lib/queries/league-home-standings";

type LeagueHomeStandingsTabProps = {
  bundleInput: LeagueHomeStandingsBundleInput;
  leagueSlug: string;
  myTeamPublicId: string | null;
  showFaabBudget: boolean;
};

export async function LeagueHomeStandingsTab({
  bundleInput,
  leagueSlug,
  myTeamPublicId,
  showFaabBudget,
}: LeagueHomeStandingsTabProps) {
  const { standings } = await getLeagueHomeStandingsBundle(bundleInput);

  return (
    <LeagueStandingsTable
      rows={standings}
      showFaabBudget={showFaabBudget}
      leagueSlug={leagueSlug}
      myTeamSlug={myTeamPublicId}
    />
  );
}
