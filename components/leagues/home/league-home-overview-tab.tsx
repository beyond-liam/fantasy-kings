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
import { getGameWeekCloseState } from "@/lib/nfl/current-week-board";
import {
  standingsOwnerName,
  type LeagueStandingsMember,
} from "@/lib/leagues/standings";
import {
  getLeagueHomeStandingsBundle,
  type LeagueHomeStandingsBundleInput,
} from "@/lib/queries/league-home-standings";
import { loadOverviewSeasonHighlights, loadOverviewWeekHighlights } from "@/lib/queries/league-overview-highlights";
import { getLeaguePositionStats } from "@/lib/queries/league-stats";
import { loadOverviewWeeklyRoast } from "@/lib/queries/overview-weekly-roast";
import { resolvePlayerScorePoint } from "@/lib/leagues/schedule/player-score-point";
import { nflToFantasyWeek } from "@/lib/leagues/schedule/fantasy-week-map";
import { getNflState } from "@/lib/sleeper/api";

const EMPTY_PLAYER_LEADERS = {
  passer: null,
  rusher: null,
  receiver: null,
};

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
        playersOfTheWeek={EMPTY_PLAYER_LEADERS}
        playersOfTheSeason={EMPTY_PLAYER_LEADERS}
        highlightWeek={null}
        weeklyRoast={null}
      />
    );
  }

  const scoringRules = resolveScoringRuleDefinitions(
    (bundleInput.scoringPreset ?? "full_ppr") as ScoringPreset,
    bundleInput.scoringRules,
  );

  const leagueSeasonId = bundleInput.leagueSeasonId;
  const closePromise = getGameWeekCloseState(bundleInput.schedule);
  const [nflState, stats, seasonOpf] = await Promise.all([
    getNflState().catch(() => null),
    getLeaguePositionStats(leagueSlug, userId),
    closePromise.then((state) =>
      getSeasonOpfByTeamId(leagueSeasonId, {
        excludeWeek: state.weekFinalized ? null : state.fantasyWeek,
      }).catch(() => new Map()),
    ),
  ]);

  const scorePoint = nflState
    ? resolvePlayerScorePoint({
        selectedWeek: 0,
        kind: "stats",
        nfl: nflState,
        schedule: bundleInput.schedule ?? null,
        seasonYear: bundleInput.seasonYear,
      })
    : { seasonType: "regular" as const, week: 0 };
  const highlightWeek =
    scorePoint.week >= 1
      ? (nflToFantasyWeek(scorePoint, bundleInput.schedule) ?? scorePoint.week)
      : null;

  const emptyHighlights = {
    playersOfTheWeek: EMPTY_PLAYER_LEADERS,
    week: highlightWeek ?? 1,
  };

  const [weekHighlights, seasonHighlights, weeklyRoast] = await Promise.all([
    scorePoint.week >= 1
      ? loadOverviewWeekHighlights({
          seasonYear: bundleInput.seasonYear,
          week: scorePoint.week,
          seasonType: scorePoint.seasonType,
          scoringRules,
        }).catch(() => emptyHighlights)
      : Promise.resolve(emptyHighlights),
    loadOverviewSeasonHighlights({
      seasonYear: bundleInput.seasonYear,
      week: scorePoint.week,
      seasonType: scorePoint.seasonType,
      scoringRules,
      schedule: bundleInput.schedule,
    }).catch(() => EMPTY_PLAYER_LEADERS),
    useOverviewMock
      ? Promise.resolve(getOverviewWeeklyRoastMock())
      : loadOverviewWeeklyRoast({
          leagueSeasonId,
          regularSeasonEndWeek: bundleInput.regularSeasonEndWeek,
          schedule: bundleInput.schedule,
          teams: standingsTeams
            .filter((t) => t.userId && t.teamId)
            .map((t) => ({
              teamId: t.teamId!,
              teamPublicId: t.teamPublicId ?? null,
              teamName: t.teamName ?? "Team",
              ownerName: standingsOwnerName(t, "Manager"),
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
      playersOfTheSeason={seasonHighlights}
      highlightWeek={highlightWeek}
      weeklyRoast={weeklyRoast}
    />
  );
}
