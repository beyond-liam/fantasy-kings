import { LeagueOverview } from "@/components/leagues/league-overview";
import {
  buildSeasonPositionLeaders,
  rankByInefficiency,
  rankByPointsAgainst,
  rankByPointsFor,
  sliceStandingsAroundFocus,
} from "@/lib/leagues/league-overview";
import { getOverviewWeeklyRoastMock } from "@/lib/leagues/overview-weekly-roast-mock";
import {
  resolveScoringRuleDefinitions,
  type ScoringPreset,
} from "@/lib/leagues/scoring";
import { getSeasonOpfByTeamId } from "@/lib/leagues/team-week-stats";
import type { LeagueStandingsMember } from "@/lib/leagues/standings";
import {
  getLeagueHomeStandingsBundle,
  type LeagueHomeStandingsBundleInput,
} from "@/lib/queries/league-home-standings";
import { loadOverviewWeekHighlights } from "@/lib/queries/league-overview-highlights";
import { getLeaguePositionStats } from "@/lib/queries/league-stats";
import { loadOverviewWeeklyRoast } from "@/lib/queries/overview-weekly-roast";
import { getNflState } from "@/lib/sleeper/api";

type LeagueHomeOverviewTabProps = {
  bundleInput: LeagueHomeStandingsBundleInput;
  leagueSlug: string;
  userId: string;
  myTeamId: string | null;
  standingsTeams: LeagueStandingsMember[];
  useOverviewMock: boolean;
};

export async function LeagueHomeOverviewTab({
  bundleInput,
  leagueSlug,
  userId,
  myTeamId,
  standingsTeams,
  useOverviewMock,
}: LeagueHomeOverviewTabProps) {
  const { standings } = await getLeagueHomeStandingsBundle(bundleInput);

  const claimedStandings = standings.filter((row) => row.claimed);
  const focusIndex = myTeamId
    ? claimedStandings.findIndex((row) => row.teamId === myTeamId)
    : -1;
  const overviewStandings = sliceStandingsAroundFocus(
    claimedStandings,
    focusIndex,
  );

  if (bundleInput.leagueSeasonId == null || bundleInput.seasonYear == null) {
    return (
      <LeagueOverview
        leagueSlug={leagueSlug}
        standingsRows={overviewStandings}
        myTeamId={myTeamId}
        highestScorer={rankByPointsFor(standings)[0] ?? null}
        worstDefense={rankByPointsAgainst(standings)[0] ?? null}
        inefficient={null}
        seasonLeaders={[]}
        playersOfTheWeek={{
          passer: null,
          rusher: null,
          receiver: null,
        }}
        highlightWeek={null}
        weeklyRoast={null}
      />
    );
  }

  const scoringRules = resolveScoringRuleDefinitions(
    (bundleInput.scoringPreset ?? "full_ppr") as ScoringPreset,
    bundleInput.scoringRules,
  );

  const [nflState, seasonOpf, stats] = await Promise.all([
    getNflState().catch(() => null),
    getSeasonOpfByTeamId(bundleInput.leagueSeasonId).catch(() => new Map()),
    getLeaguePositionStats(leagueSlug, userId),
  ]);

  const highlightWeek = Math.max(1, Number(nflState?.week) || 1);

  const [weekHighlights, weeklyRoast] = await Promise.all([
    loadOverviewWeekHighlights({
      seasonYear: bundleInput.seasonYear,
      week: highlightWeek,
      scoringRules,
    }).catch(() => ({
      playersOfTheWeek: {
        passer: null,
        rusher: null,
        receiver: null,
      },
      week: highlightWeek,
    })),
    useOverviewMock
      ? Promise.resolve(getOverviewWeeklyRoastMock())
      : loadOverviewWeeklyRoast({
          leagueSeasonId: bundleInput.leagueSeasonId,
          regularSeasonEndWeek: bundleInput.regularSeasonEndWeek,
          teams: standingsTeams
            .filter((t) => t.userId && t.teamId)
            .map((t) => ({
              teamId: t.teamId!,
              teamPublicId: t.teamPublicId ?? null,
              teamName: t.teamName ?? "Team",
              ownerName: t.displayName?.trim() || "Manager",
              ownerUserId: t.userId,
              logoUrl: t.logoUrl ?? null,
            })),
        }).catch(() => null),
  ]);

  const seasonLeaders = buildSeasonPositionLeaders(
    claimedStandings
      .filter((row): row is typeof row & { teamId: string } =>
        Boolean(row.teamId),
      )
      .map((row) => ({
        teamId: row.teamId,
        teamPublicId: row.teamPublicId,
        teamName: row.teamName,
        logoUrl: row.logoUrl,
        claimed: row.claimed,
        byPosition: seasonOpf.get(row.teamId)?.byPosition ?? {},
      })),
  );

  const inefficient = rankByInefficiency(
    (stats?.rows ?? []).map((row) => ({
      teamId: row.teamId,
      teamPublicId: row.teamPublicId,
      teamName: row.teamName,
      ownerName: row.ownerName,
      ownerUserId: row.ownerUserId,
      logoUrl: row.logoUrl,
      claimed: row.claimed,
      seasonPointsFor: row.seasonPointsFor,
      seasonOptimumPointsFor: row.seasonOptimumPointsFor,
    })),
  );

  return (
    <LeagueOverview
      leagueSlug={leagueSlug}
      standingsRows={overviewStandings}
      myTeamId={myTeamId}
      highestScorer={rankByPointsFor(standings)[0] ?? null}
      worstDefense={rankByPointsAgainst(standings)[0] ?? null}
      inefficient={inefficient[0] ?? null}
      seasonLeaders={seasonLeaders}
      playersOfTheWeek={weekHighlights.playersOfTheWeek}
      highlightWeek={weekHighlights.week}
      weeklyRoast={weeklyRoast}
    />
  );
}
