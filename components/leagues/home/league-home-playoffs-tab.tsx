import { LeaguePlayoffsSection } from "@/components/leagues/playoffs/league-playoffs-section";
import {
  getLeagueHomeStandingsBundle,
  loadHydratedPlayoffBracket,
  type LeagueHomeStandingsBundleInput,
} from "@/lib/queries/league-home-standings";

type LeagueHomePlayoffsTabProps = {
  bundleInput: LeagueHomeStandingsBundleInput;
  leagueSlug: string;
  myTeamPublicId: string | null;
  showFaabBudget: boolean;
};

export async function LeagueHomePlayoffsTab({
  bundleInput,
  leagueSlug,
  myTeamPublicId,
  showFaabBudget,
}: LeagueHomePlayoffsTabProps) {
  const {
    playoffStandings,
    playoffCutoffSeed,
    playoffSettings,
    playoffTeamCount,
  } = await getLeagueHomeStandingsBundle(bundleInput);

  const playoffBracket =
    bundleInput.leagueSeasonId != null && playoffSettings.enabled
      ? await loadHydratedPlayoffBracket({
          leagueSeasonId: bundleInput.leagueSeasonId,
          playoffStandings,
          playoffTeamCount,
          championshipWeek: bundleInput.championshipWeek,
          playoffSettings,
        })
      : null;

  return (
    <LeaguePlayoffsSection
      rows={playoffStandings}
      showFaabBudget={showFaabBudget}
      leagueSlug={leagueSlug}
      myTeamPublicId={myTeamPublicId}
      playoffCutoffSeed={playoffCutoffSeed}
      bracket={playoffBracket}
    />
  );
}
