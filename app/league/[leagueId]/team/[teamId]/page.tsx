import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect, notFound } from "next/navigation";

import { UserWarning02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { MyTeamDraftPicksPanel } from "@/components/team/panels/my-team-draft-picks";
import { TeamH2hSection } from "@/components/team/team-h2h-section";
import { TeamRosterSections } from "@/components/team/roster-sections";
import { TeamScheduleList } from "@/components/team/team-schedule-list";
import { TeamStatsSections } from "@/components/team/stats-sections";
import {
  OTHER_TEAM_TABS,
  type OtherTeamTabValue,
} from "@/components/team/team-tab-config";
import { TeamTabs } from "@/components/team/team-tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getSessionUser } from "@/lib/auth/session";
import {
  resolveScoringRuleDefinitions,
  type ScoringPreset,
} from "@/lib/leagues/scoring";
import { ensureSeasonTeamPublicIds } from "@/lib/leagues/ensure-public-ids";
import {
  getFinalMatchupsForSeason,
  recordsFromFinalMatchups,
} from "@/lib/leagues/matchups/finals";
import {
  buildScheduleDisplayRows,
  weeklyRanksByWeekFromFinals,
} from "@/lib/leagues/schedule-display";
import { buildTeamH2hSeries } from "@/lib/leagues/team-h2h";
import { myTeamPath } from "@/lib/leagues/utils";
import { canProposeTrades } from "@/lib/leagues/trades/guards";
import {
  parseWeekQueryParam,
  resolveFantasyMatchupWeek,
} from "@/lib/leagues/matchup-week";
import { overlayPlanSlots } from "@/lib/leagues/lineup-plans";
import {
  loadMyTeamNflContext,
  withPlayerOpponent,
} from "@/components/team/panels/load-my-team-nfl-context";
import { getPositionalSosTable } from "@/lib/queries/positional-sos";
import { getTeamLineupPlanSlots } from "@/lib/queries/lineup-plans";
import { getLeagueHomeData } from "@/lib/queries/leagues";
import { getTeamSchedule } from "@/lib/queries/matchups";
import { getRankedPlayers, getWeekProjectedFantasyPoints } from "@/lib/queries/players";
import { getRosterEvaluationByMode } from "@/lib/queries/roster-evaluation";
import { getTeamStatsCharts } from "@/lib/queries/team-stats-charts";
import { getRosterEvaluationByModeMock } from "@/lib/leagues/roster-evaluation/mock";
import { getTeamStatsChartsMock } from "@/lib/leagues/team-stats-charts-mock";
import { getPlayerRosterRatesMap } from "@/lib/queries/player-roster-rates";
import { enrichScheduleWinChances } from "@/lib/queries/schedule-win-chance";
import { getLeagueTeamByPublicId } from "@/lib/queries/team";
import {
  getRosterTableStatMap,
  getTeamRosterStatPlayers,
  withRosterTableStats,
} from "@/lib/queries/team-player-stats";
import {
  ensureTeamRosterSlotsAssigned,
  getTeamRosterPlayers,
} from "@/lib/queries/team-roster";
import { getUserTeamForLeague } from "@/lib/queries/watchlist";
import { teamInitials } from "@/lib/leagues/standings";
import {
  formatWaiverPriority,
  resolveTeamSummaryMatchups,
  type TeamSummaryScheduleRow,
} from "@/lib/leagues/team-summary";

type LeagueTeamPageProps = {
  params: Promise<{ leagueId: string; teamId: string }>;
  searchParams: Promise<{ tab?: string; mock?: string; week?: string }>;
};

export async function generateMetadata({
  params,
}: LeagueTeamPageProps): Promise<Metadata> {
  const { leagueId: slug, teamId } = await params;
  const user = await getSessionUser();
  if (!user) {
    return { title: "Team" };
  }

  const data = await getLeagueHomeData(slug, user.id);
  if (!data?.season) {
    return { title: "Team" };
  }

  await ensureSeasonTeamPublicIds(data.season.id);
  const team = await getLeagueTeamByPublicId(data.season.id, teamId);
  return { title: team?.name ?? "Team" };
}

const TAB_VALUES = new Set<string>(OTHER_TEAM_TABS.map((tab) => tab.value));

function resolveActiveTab(tab: string | undefined): OtherTeamTabValue {
  if (tab && TAB_VALUES.has(tab)) {
    return tab as OtherTeamTabValue;
  }
  return "roster";
}

export default async function LeagueTeamPage({
  params,
  searchParams,
}: LeagueTeamPageProps) {
  const { leagueId: slug, teamId } = await params;
  const { tab, mock, week: weekParam } = await searchParams;
  const useChartsMock =
    process.env.NODE_ENV === "development" && (mock === "1" || mock === "true");
  const activeTab = resolveActiveTab(tab);

  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/team/${teamId}`);
  }

  const [data, myTeam] = await Promise.all([
    getLeagueHomeData(slug, user.id),
    getUserTeamForLeague(slug, user.id),
  ]);

  if (!data || !data.isMember || !data.season) {
    redirect("/leagues");
  }

  // Legacy slug bookmark → canonical public id URL
  if (data.league.publicId !== slug) {
    redirect(`/league/${data.league.publicId}/team/${teamId}`);
  }

  const season = data.season;
  await ensureSeasonTeamPublicIds(season.id);

  const team = await getLeagueTeamByPublicId(season.id, teamId);
  if (!team) {
    notFound();
  }

  if (myTeam?.id === team.id) {
    redirect(myTeamPath(slug));
  }

  const scoringPreset = season.scoringPreset as ScoringPreset;
  const scoringRules = resolveScoringRuleDefinitions(
    scoringPreset,
    season.settings.scoringRules,
  );
  const tradesEnabled = Boolean(myTeam) && canProposeTrades(season).ok;

  const needsRosterPanel = activeTab === "roster";
  const needsStatsPanel = activeTab === "stats";
  const needsSchedulePanel = activeTab === "schedule";
  const needsH2hPanel = activeTab === "head-to-head";
  const needsDraftPicksPanel = activeTab === "draft-picks";

  const needsNflContext =
    needsRosterPanel || needsStatsPanel || needsSchedulePanel;
  const needsOtherTeamSchedule = needsRosterPanel || needsSchedulePanel;
  const needsViewerSchedule = needsH2hPanel && Boolean(myTeam);

  const rosterWeek = needsRosterPanel
    ? await resolveFantasyMatchupWeek({
        seasonYear: season.seasonYear,
        nflRegularSeasonEndWeek: season.regularSeasonEndWeek,
        schedule: season.settings.schedule,
        requestedWeek: parseWeekQueryParam(weekParam),
      })
    : null;

  if (needsRosterPanel || needsStatsPanel) {
    await ensureTeamRosterSlotsAssigned({
      teamId: team.id,
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
      irEnabled: season.irEnabled,
      taxiEnabled: season.taxiEnabled,
      leagueSeasonId: season.id,
      schedule: season.settings.schedule,
      seasonYear: season.seasonYear,
      regularSeasonEndWeek: season.regularSeasonEndWeek,
      currentWeek: rosterWeek?.currentWeek,
    });
  }

  const [
    loadedRosterPlayers,
    scheduleRows,
    viewerScheduleRows,
    nflContext,
    finals,
  ] = await Promise.all([
    needsRosterPanel || needsStatsPanel
      ? getTeamRosterPlayers(team.id)
      : Promise.resolve([]),
    needsOtherTeamSchedule
      ? getTeamSchedule(season.id, team.id)
      : Promise.resolve([]),
    needsViewerSchedule && myTeam
      ? getTeamSchedule(season.id, myTeam.id)
      : Promise.resolve([]),
    needsNflContext
      ? loadMyTeamNflContext({
          seasonYear: season.seasonYear,
          schedule: season.settings.schedule,
          fantasyWeek: rosterWeek?.week,
        })
      : Promise.resolve(null),
    needsSchedulePanel
      ? getFinalMatchupsForSeason(season.id).catch(() => [])
      : Promise.resolve([]),
  ]);

  const viewedWeek = rosterWeek?.week ?? null;
  const currentWeek = rosterWeek?.currentWeek ?? null;
  const planSlots =
    needsRosterPanel &&
    viewedWeek != null &&
    currentWeek != null &&
    viewedWeek > currentWeek
      ? await getTeamLineupPlanSlots({
          leagueSeasonId: season.id,
          teamId: team.id,
          week: viewedWeek,
        })
      : null;
  const rosterPlayers = planSlots
    ? overlayPlanSlots(loadedRosterPlayers, planSlots)
    : loadedRosterPlayers;

  const rosterPlayerIds = rosterPlayers.map((player) => player.id);
  const fantasyWeek = nflContext?.fantasyWeek ?? 1;
  const nflWeek = nflContext?.nflWeek ?? 1;
  const nflSeasonType = nflContext?.nflSeasonType ?? "regular";
  const nflSeason =
    nflContext?.nflSeason ?? String(season.seasonYear);
  const scoreboard = nflContext?.scoreboard ?? null;
  const opponentsByTeam = nflContext?.opponentsByTeam ?? new Map();

  const sos =
    rosterPlayers.length > 0
      ? await getPositionalSosTable({
          season: nflSeason,
          positionIds: rosterPlayers.map((player) => player.primaryPositionId),
          rules: scoringRules,
        })
      : new Map();

  const withOpponent = <
    T extends { nflTeam: string | null; byeWeek: number | null; primaryPositionId?: string },
  >(
    player: T,
  ) =>
    withPlayerOpponent(player, nflWeek, opponentsByTeam, {
      seasonYear: season.seasonYear,
      seasonType: nflSeasonType,
      sos,
    });

  let rosterPanel: ReactNode = null;
  let statsPanel: ReactNode = null;
  let schedulePanel: ReactNode = null;
  let h2hPanel: ReactNode = null;
  let draftPicksPanel: ReactNode = null;

  if (needsRosterPanel) {
    const [rosterRates, projectedById, weekStats, tableStats] =
      await Promise.all([
        getPlayerRosterRatesMap(rosterPlayerIds),
        rosterPlayerIds.length > 0
          ? getWeekProjectedFantasyPoints({
              season: nflSeason,
              week: nflWeek,
              seasonType: nflSeasonType,
              scoringRules,
              playerIds: rosterPlayerIds,
            })
          : Promise.resolve(new Map<string, number | null>()),
        rosterPlayerIds.length > 0
          ? getRankedPlayers({
              season: nflSeason,
              week: nflWeek,
              seasonType: nflSeasonType,
              kind: "stats",
              scoringRules,
              playerIds: rosterPlayerIds,
              preserveStats: true,
            }).catch(() => [])
          : Promise.resolve([]),
        rosterPlayerIds.length > 0 && nflContext
          ? getRosterTableStatMap({
              season: nflSeason,
              playerIds: rosterPlayerIds,
              scoringRules,
              nfl: nflContext.nflState,
              schedule: season.settings.schedule,
            }).catch(() => new Map())
          : Promise.resolve(new Map()),
      ]);

    const actualById = new Map(
      weekStats.map((player) => [player.id, player.fantasyPts]),
    );
    const weekStatsById = new Map(
      weekStats.map((player) => [player.id, player.stats]),
    );

    const rosterPlayersWithRates = rosterPlayers.map((player) => {
      const rates = rosterRates.get(player.id);
      return withOpponent(
        withRosterTableStats(
          {
            ...player,
            ownedPct: rates?.ownedPct ?? null,
            startPct: rates?.startPct ?? null,
            actualPts: actualById.get(player.id) ?? null,
            projectedPts: projectedById.get(player.id) ?? null,
            weekStats: weekStatsById.get(player.id),
          },
          tableStats,
        ),
      );
    });

    const summarySchedule: TeamSummaryScheduleRow[] = scheduleRows.map(
      (row) => ({
        week: row.week,
        publicId: row.publicId,
        opponentName: row.opponentName,
        opponentSlug: row.opponentSlug,
        isHome: row.isHome,
        status: row.status,
        teamPts: row.isHome ? row.homePts : row.awayPts,
        opponentPts: row.isHome ? row.awayPts : row.homePts,
      }),
    );
    const { previous, current } = resolveTeamSummaryMatchups(
      summarySchedule,
      fantasyWeek,
    );

    rosterPanel = (
      <TeamRosterSections
        rosterSlots={season.settings.rosterSlots}
        benchSlots={season.benchSlots}
        irEnabled={season.irEnabled}
        irSlots={season.irSlots}
        irEligibleStatuses={season.settings.irEligibleStatuses}
        taxiEnabled={season.taxiEnabled}
        taxiSlots={season.taxiSlots}
        taxiMaxYearsExp={season.settings.taxiMaxYearsExp}
        taxiPreventReaddAfterActivation={
          season.settings.taxiPreventReaddAfterActivation === true
        }
        players={rosterPlayersWithRates}
        leagueSlug={slug}
        actionsEnabled={false}
        rowActionsEnabled={tradesEnabled}
        cutActionsEnabled={false}
        actionsVariant="opponent"
        partnerTeamSlug={team.publicId ?? team.slug}
        tradesEnabled={tradesEnabled}
        scoringRules={scoringRules}
        scoringWeek={fantasyWeek}
        week={rosterWeek?.week ?? fantasyWeek}
        currentWeek={rosterWeek?.currentWeek}
        weeks={rosterWeek?.weeks}
        summary={{
          waiverPriorityLabel: season.waiversEnabled
            ? formatWaiverPriority(team.waiverPriority)
            : null,
          ownerName: team.ownerName,
          previous,
          current,
          myTeamSlug: myTeam?.publicId ?? myTeam?.slug ?? null,
        }}
      />
    );
  }

  if (needsStatsPanel) {
    const [seasonRows, charts, rosterEvaluationByMode] =
      await Promise.all([
        rosterPlayerIds.length > 0
          ? getTeamRosterStatPlayers({
              season: nflSeason,
              playerIds: rosterPlayerIds,
              scoringRules,
              nfl: nflContext?.nflState ?? {
                season: nflSeason,
                season_type: nflSeasonType,
                week: nflWeek,
                display_week: nflWeek,
              },
              schedule: season.settings.schedule,
            }).catch(() => [])
          : Promise.resolve([]),
        useChartsMock
          ? Promise.resolve(getTeamStatsChartsMock())
          : getTeamStatsCharts({
              leagueSlug: slug,
              teamId: team.id,
            }).catch(() => null),
        useChartsMock
          ? Promise.resolve(getRosterEvaluationByModeMock())
          : getRosterEvaluationByMode({
              leagueSlug: slug,
              teamId: team.id,
              upcomingWeek: fantasyWeek,
            }).catch(() => null),
      ]);
    const scoredPlayers = seasonRows.map((player) =>
      withOpponent(player),
    );
    statsPanel = (
      <TeamStatsSections
        players={scoredPlayers}
        leagueSlug={slug}
        charts={charts}
        upcomingWeek={fantasyWeek}
        rosterEvaluationByMode={rosterEvaluationByMode}
      />
    );
  }

  if (needsSchedulePanel) {
    const weekRangeByNumber = new Map(
      (scoreboard?.weeks ?? []).map((week) => [week.number, week.rangeLabel]),
    );
    const winChances =
      scheduleRows.length > 0 && nflContext
        ? await enrichScheduleWinChances({
            focusTeamId: team.id,
            schedule: scheduleRows,
            rosterSlots: season.settings.rosterSlots,
            benchSlots: season.benchSlots,
            irEnabled: season.irEnabled,
            irSlots: season.irSlots,
            irEligibleStatuses: season.settings.irEligibleStatuses,
            taxiEnabled: season.taxiEnabled,
            taxiSlots: season.taxiSlots,
            seasonYear: nflSeason,
            currentWeek: nflWeek,
            scoringRules,
            scoreboardGames: scoreboard?.games ?? [],
          }).catch(() => new Map<string, number | null>())
        : new Map<string, number | null>();
    const records = recordsFromFinalMatchups(finals);
    const scheduleDisplayRows = buildScheduleDisplayRows({
      rows: scheduleRows,
      weekRangeByNumber,
      records,
      winChances,
      weeklyRanksByWeek: weeklyRanksByWeekFromFinals(finals, team.id),
    });
    schedulePanel = (
      <TeamScheduleList
        rows={scheduleDisplayRows}
        leagueSlug={slug}
        myTeamSlug={myTeam?.publicId ?? null}
      />
    );
  }

  if (needsH2hPanel) {
    if (!myTeam) {
      h2hPanel = (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={UserWarning02Icon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>No team yet</EmptyTitle>
            <EmptyDescription>
              Claim a team in this league to see head-to-head history.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    } else {
      const series = buildTeamH2hSeries(
        viewerScheduleRows,
        team.id,
        season.seasonYear,
      );
      h2hPanel = (
        <TeamH2hSection
          series={series}
          leagueSlug={slug}
          viewerTeamName={myTeam.name}
          opponentTeamName={team.name}
        />
      );
    }
  }

  if (needsDraftPicksPanel) {
    draftPicksPanel = (
      <MyTeamDraftPicksPanel
        teamId={team.id}
        leagueSlug={slug}
        leagueId={data.league.id}
        leagueType={season.leagueType}
        seasonYear={season.seasonYear}
        tradesEnabled={tradesEnabled}
        variant="other"
        partnerTeamSlug={team.publicId ?? team.slug}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Avatar size="lg" className="shrink-0">
          {team.logoUrl ? <AvatarImage src={team.logoUrl} alt="" /> : null}
          <AvatarFallback>{teamInitials(team.name)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-0">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {team.name}
          </h1>
          <p className="text-sm text-pretty text-muted-foreground">
            Managed by {team.ownerName?.trim() || "Manager"}
          </p>
        </div>
      </div>

      <TeamTabs
        variant="other"
        defaultTab={activeTab}
        roster={rosterPanel}
        stats={statsPanel}
        schedule={schedulePanel}
        head-to-head={h2hPanel}
        draft-picks={draftPicksPanel}
      />
    </div>
  );
}
