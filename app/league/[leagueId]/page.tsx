import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { InviteLinkCard } from "@/components/leagues/invite-link-card";
import { DraftUnderwayAlert } from "@/components/leagues/draft/draft-underway-alert";
import { LeagueHallOfFame } from "@/components/leagues/hall-of-fame/league-hall-of-fame";
import { LeagueHomeTabs } from "@/components/leagues/league-home-tabs";
import { LeagueOverview } from "@/components/leagues/league-overview";
import { LeagueStandingsTable } from "@/components/leagues/standings/standings-table";
import { LeagueStatsTable } from "@/components/leagues/stats/league-stats-table";
import { LeaguePlayoffsSection } from "@/components/leagues/playoffs/league-playoffs-section";
import { LeagueRulesSummary } from "@/components/leagues/rules/league-rules-summary";
import { LeagueScoringSummary } from "@/components/leagues/scoring/league-scoring-summary";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { getSessionUser } from "@/lib/auth/session";
import {
  buildLeagueStandings,
} from "@/lib/leagues/standings-from-matchups";
import { teamInitials } from "@/lib/leagues/standings";
import { formatLeagueLabel } from "@/lib/leagues/format";
import {
  bracketTeamsFromStandings,
  buildPlayoffBracket,
} from "@/lib/leagues/playoff-bracket";
import { hydratePlayoffBracket } from "@/lib/leagues/playoff-bracket-hydrate";
import {
  attachSosToStandings,
  buildPlayoffStandingsRows,
  resolvePlayoffCutoffSeed,
} from "@/lib/leagues/playoff-standings";
import {
  clampPlayoffTeamCount,
  resolvePlayoffSettings,
} from "@/lib/leagues/playoff-settings";
import { resolveTeamStrengthForSos } from "@/lib/leagues/sos";
import {
  resolveScoringRuleDefinitions,
  type ScoringPreset,
} from "@/lib/leagues/scoring";
import { getPlayoffWeekRange } from "@/lib/leagues/season-calendar";
import {
  buildSeasonPositionLeaders,
  rankByInefficiency,
  rankByPointsAgainst,
  rankByPointsFor,
  sliceStandingsAroundFocus,
} from "@/lib/leagues/league-overview";
import { getSeasonOpfByTeamId } from "@/lib/leagues/team-week-stats";
import { getLeagueHomeData, isDraftUnderway } from "@/lib/queries/leagues";
import { getLeaguePositionStats } from "@/lib/queries/league-stats";
import { loadOverviewWeekHighlights } from "@/lib/queries/league-overview-highlights";
import {
  emptyLeagueHallOfFame,
  loadLeagueHallOfFame,
} from "@/lib/queries/league-hall-of-fame";
import { loadOverviewWeeklyRoast } from "@/lib/queries/overview-weekly-roast";
import { getOverviewWeeklyRoastMock } from "@/lib/leagues/overview-weekly-roast-mock";
import { getSeasonMatchups } from "@/lib/queries/matchups";
import { getTeamProjectedWeeklyPf } from "@/lib/queries/team-projected-strength";
import { getNflState } from "@/lib/sleeper/api";
import { db } from "@/lib/db";
import { matchups } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";

type LeagueHomePageProps = {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ mock?: string }>;
};

export const metadata: Metadata = {
  title: "League",
};

export default async function LeagueHomePage({
  params,
  searchParams,
}: LeagueHomePageProps) {
  const { leagueId: slug } = await params;
  const { mock } = await searchParams;
  const useOverviewMock = mock === "1" || mock === "true";
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}`);
  }

  const data = await getLeagueHomeData(slug, user.id);
  if (!data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <Empty className="border-none">
          <EmptyHeader>
            <EmptyTitle>League not found</EmptyTitle>
            <EmptyDescription>
              This league doesn&apos;t exist or you don&apos;t have access.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button nativeButton={false} render={<Link href="/leagues" />}>
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Back to Leagues
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  if (!data.isMember) {
    redirect("/leagues");
  }

  const statsPromise = getLeaguePositionStats(slug, user.id);

  const { league, season, members, draftStatus, standingsTeams } = data;
  const claimedCount = standingsTeams.filter((team) => team.userId).length;
  const isFull = season != null && claimedCount >= season.teamCount;
  const draftUnderway = isDraftUnderway(draftStatus);
  const showFaabBudget =
    Boolean(season?.waiversEnabled) &&
    season?.waiverType === "faab" &&
    season.faabBudget != null &&
    season.faabBudget > 0;
  const seasonMatchups =
    season != null
      ? await getSeasonMatchups(season.id).catch(() => [])
      : [];
  const regularSeasonEndWeek = season?.regularSeasonEndWeek ?? 14;
  const finals = seasonMatchups
    .filter(
      (row) =>
        row.status === "final" &&
        row.week <= regularSeasonEndWeek &&
        row.homePts != null &&
        row.awayPts != null,
    )
    .map((row) => ({
      id: row.id,
      week: row.week,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      homePts: row.homePts,
      awayPts: row.awayPts,
    }));
  const sosMatchups = seasonMatchups
    .filter((row) => row.week <= regularSeasonEndWeek)
    .map((row) => ({
      week: row.week,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      played: row.status === "final",
    }));
  const remainingMatchups = sosMatchups
    .filter((row) => !row.played)
    .map((row) => ({
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
    }));
  const baseStandings = buildLeagueStandings(
    standingsTeams,
    {
      teamCount: season?.teamCount ?? members.length,
      faabBudget: showFaabBudget ? season.faabBudget : null,
    },
    finals,
    season?.settings.tiebreakers,
  );
  const claimedTeamIds = baseStandings
    .filter((row): row is typeof row & { teamId: string } =>
      Boolean(row.claimed && row.teamId),
    )
    .map((row) => row.teamId);

  let projectedWeeklyPf = new Map<string, number>();
  if (season && claimedTeamIds.length > 0) {
    const scoringRules = resolveScoringRuleDefinitions(
      season.scoringPreset as ScoringPreset,
      season.settings.scoringRules,
    );
    const nflState = await getNflState().catch(() => null);
    const projectionWeek = Math.max(1, Number(nflState?.week) || 1);
    projectedWeeklyPf = await getTeamProjectedWeeklyPf({
      teamIds: claimedTeamIds,
      seasonYear: String(season.seasonYear),
      week: projectionWeek,
      scoringRules,
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
      irEnabled: season.irEnabled,
      irSlots: season.irSlots,
      irEligibleStatuses: season.settings.irEligibleStatuses,
      taxiEnabled: season.taxiEnabled,
      taxiSlots: season.taxiSlots,
    }).catch(() => new Map());
  }

  const strengthByTeamId = resolveTeamStrengthForSos({
    teamIds: claimedTeamIds,
    pointsForAvgByTeamId: new Map(
      baseStandings
        .filter((row) => row.teamId && row.claimed)
        .map((row) => [row.teamId!, row.pointsForAvg] as const),
    ),
    projectedWeeklyPfByTeamId: projectedWeeklyPf,
  });

  const standings = attachSosToStandings(
    baseStandings,
    sosMatchups,
    projectedWeeklyPf,
  );
  const playoffSettings = resolvePlayoffSettings(season?.settings.playoffs);
  const playoffTeamCount =
    season != null
      ? clampPlayoffTeamCount(season.playoffTeamCount, season.teamCount)
      : 0;
  const playoffCutoffSeed = resolvePlayoffCutoffSeed({
    enabled: playoffSettings.enabled,
    playoffTeamCount,
    teamCount: standings.length,
  });
  const playoffStandings = buildPlayoffStandingsRows(standings, {
    playoffSpots: playoffSettings.enabled ? playoffTeamCount : 0,
    remainingMatchups: playoffSettings.enabled ? remainingMatchups : [],
    strengthByTeamId,
  });
  const seedTeams =
    season && playoffSettings.enabled
      ? bracketTeamsFromStandings(playoffStandings, playoffTeamCount)
      : [];
  let playoffBracket =
    season && playoffSettings.enabled
      ? buildPlayoffBracket({
          teams: seedTeams,
          playoffTeamCount,
          championshipWeek: season.championshipWeek,
          twoWeekChampionship: playoffSettings.twoWeekChampionship,
          enabled: true,
        })
      : null;

  if (season && playoffBracket) {
    const range = getPlayoffWeekRange(
      season.championshipWeek,
      playoffTeamCount,
      {
        enabled: true,
        twoWeekChampionship: playoffSettings.twoWeekChampionship,
      },
    );
    if (range) {
      const playoffRows = await db
        .select({
          week: matchups.week,
          homeTeamId: matchups.homeTeamId,
          awayTeamId: matchups.awayTeamId,
          homePts: matchups.homePts,
          awayPts: matchups.awayPts,
          status: matchups.status,
        })
        .from(matchups)
        .where(
          and(
            eq(matchups.leagueSeasonId, season.id),
            gte(matchups.week, range.startWeek),
          ),
        )
        .catch(() => []);

      if (playoffRows.length > 0) {
        playoffBracket = hydratePlayoffBracket(
          playoffBracket,
          playoffRows,
          seedTeams,
        );
      }
    }
  }
  const myTeamPublicId =
    members.find((member) => member.userId === user.id)?.teamPublicId ?? null;
  const myTeamId =
    members.find((member) => member.userId === user.id)?.teamId ?? null;
  const stats = await statsPromise;

  const claimedStandings = standings.filter((row) => row.claimed);
  const focusIndex = myTeamId
    ? claimedStandings.findIndex((row) => row.teamId === myTeamId)
    : -1;
  const overviewStandings = sliceStandingsAroundFocus(
    claimedStandings,
    focusIndex,
  );

  const seasonOpf =
    season != null
      ? await getSeasonOpfByTeamId(season.id).catch(() => new Map())
      : new Map();

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
      logoUrl: row.logoUrl,
      claimed: row.claimed,
      seasonPointsFor: row.seasonPointsFor,
      seasonOptimumPointsFor: row.seasonOptimumPointsFor,
    })),
  );

  const scoringRulesForOverview = season
    ? resolveScoringRuleDefinitions(
        season.scoringPreset as ScoringPreset,
        season.settings.scoringRules,
      )
    : null;

  const nflStateForOverview = season
    ? await getNflState().catch(() => null)
    : null;
  const highlightWeek = Math.max(
    1,
    Number(nflStateForOverview?.week) || 1,
  );

  const weekHighlights =
    season && scoringRulesForOverview
      ? await loadOverviewWeekHighlights({
          seasonYear: season.seasonYear,
          week: highlightWeek,
          scoringRules: scoringRulesForOverview,
        }).catch(() => ({
          playersOfTheWeek: {
            passer: null,
            rusher: null,
            receiver: null,
          },
          week: highlightWeek,
        }))
      : {
          playersOfTheWeek: {
            passer: null,
            rusher: null,
            receiver: null,
          },
          week: null as number | null,
        };

  const hofTeams = standingsTeams.map((team) => ({
    teamId: team.teamId!,
    teamPublicId: team.teamPublicId ?? null,
    teamName: team.teamName ?? "Team",
    ownerName: team.userId
      ? (team.displayName?.trim() || "Manager")
      : "Unclaimed",
    logoUrl: team.logoUrl ?? null,
    claimed: Boolean(team.userId && team.teamId),
    divisionId: team.divisionId ?? null,
  }));

  const hallOfFameData = season
    ? await loadLeagueHallOfFame({
        leagueSeasonId: season.id,
        seasonYear: season.seasonYear,
        teams: hofTeams.filter((t) => Boolean(t.teamId)),
        divisionCount: season.divisionCount,
        regularSeasonEndWeek: season.regularSeasonEndWeek,
        championTeamId: playoffBracket?.champion?.teamId ?? null,
      }).catch(() => emptyLeagueHallOfFame())
    : emptyLeagueHallOfFame();

  const weeklyRoast = useOverviewMock
    ? getOverviewWeeklyRoastMock()
    : season
      ? await loadOverviewWeeklyRoast({
          leagueSeasonId: season.id,
          regularSeasonEndWeek: season.regularSeasonEndWeek,
          teams: hofTeams
            .filter((t) => t.claimed)
            .map((t) => ({
              teamId: t.teamId,
              teamPublicId: t.teamPublicId,
              teamName: t.teamName,
              ownerName: t.ownerName,
              logoUrl: t.logoUrl,
            })),
        }).catch(() => null)
      : null;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Avatar size="lg" className="shrink-0">
          {season?.settings.logoUrl ? (
            <AvatarImage src={season.settings.logoUrl} alt="" />
          ) : null}
          <AvatarFallback>{teamInitials(league.name)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-0">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {league.name}
          </h1>
          <p className="text-sm text-pretty text-muted-foreground">
            {formatLeagueLabel(season?.leagueType ?? "redraft")}
          </p>
        </div>
      </div>

      {draftUnderway ? (
        <DraftUnderwayAlert
          slug={league.publicId}
          paused={draftStatus === "paused"}
        />
      ) : null}

      {!isFull ? <InviteLinkCard inviteCode={league.inviteCode} /> : null}

      <Suspense fallback={null}>
        <LeagueHomeTabs
          overview={
            <LeagueOverview
              leagueSlug={league.publicId}
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
          }
        standings={
          <LeagueStandingsTable
            rows={standings}
            showFaabBudget={showFaabBudget}
            leagueSlug={league.publicId}
            myTeamSlug={myTeamPublicId}
          />
        }
        stats={
          stats ? (
            <LeagueStatsTable
              rows={stats.rows}
              positionColumns={stats.positionColumns}
              leagueSlug={league.publicId}
              myTeamPublicId={myTeamPublicId}
              week={stats.week}
              scoresAvailable={stats.scoresAvailable}
            />
          ) : undefined
        }
        playoffs={
          <LeaguePlayoffsSection
            rows={playoffStandings}
            showFaabBudget={showFaabBudget}
            leagueSlug={league.publicId}
            myTeamPublicId={myTeamPublicId}
            playoffCutoffSeed={playoffCutoffSeed}
            bracket={playoffBracket}
          />
        }
        hallOfFame={
          <LeagueHallOfFame
            leagueSlug={league.publicId}
            data={hallOfFameData}
          />
        }
        rules={
          season ? (
            <LeagueRulesSummary
              season={{
                playoffTeamCount: season.playoffTeamCount,
                championshipWeek: season.championshipWeek,
                regularSeasonEndWeek: season.regularSeasonEndWeek,
                rosterMode: season.rosterMode,
                benchSlots: season.benchSlots,
                irEnabled: season.irEnabled,
                irSlots: season.irSlots,
                taxiEnabled: season.taxiEnabled,
                taxiSlots: season.taxiSlots,
                waiversEnabled: season.waiversEnabled,
                waiverType: season.waiverType,
                faabBudget: season.faabBudget,
                tradesEnabled: season.tradesEnabled,
                tradeProcessing: season.tradeProcessing,
                tradeDeadlineWeek: season.tradeDeadlineWeek,
                draftType: season.draftType,
                draftStartAt: season.draftStartAt,
                pickTimeLimitSeconds: season.pickTimeLimitSeconds,
                settings: season.settings,
              }}
            />
          ) : undefined
        }
        scoring={
          season ? (
            <LeagueScoringSummary
              scoringPreset={season.scoringPreset}
              scoringRules={season.settings.scoringRules}
            />
          ) : undefined
        }
        />
      </Suspense>
    </div>
  );
}
