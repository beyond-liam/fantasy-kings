import { LeaguePresenceProvider } from "@/components/leagues/presence/league-presence-provider";
import { LeagueStandingsTable } from "@/components/leagues/standings/standings-table";
import {
  getLeagueHomeStandingsBundle,
  type LeagueHomeStandingsBundleInput,
} from "@/lib/queries/league-home-standings";
import { getLeaguePresence } from "@/lib/queries/presence";

type LeagueHomeStandingsTabProps = {
  bundleInput: LeagueHomeStandingsBundleInput;
  leagueId: string;
  leagueSlug: string;
  myTeamPublicId: string | null;
  showFaabBudget: boolean;
};

export async function LeagueHomeStandingsTab({
  bundleInput,
  leagueId,
  leagueSlug,
  myTeamPublicId,
  showFaabBudget,
}: LeagueHomeStandingsTabProps) {
  const [{ standings }, presence] = await Promise.all([
    getLeagueHomeStandingsBundle(bundleInput),
    getLeaguePresence(leagueId),
  ]);

  return (
    <LeaguePresenceProvider slug={leagueSlug} initialSnapshot={presence}>
      <LeagueStandingsTable
        rows={standings}
        showFaabBudget={showFaabBudget}
        leagueSlug={leagueSlug}
        myTeamSlug={myTeamPublicId}
      />
    </LeaguePresenceProvider>
  );
}
