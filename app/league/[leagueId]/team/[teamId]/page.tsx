import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect, notFound } from "next/navigation";

import { TeamDraftPicksList } from "@/components/team/team-draft-picks-list";
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
  EmptyTitle,
} from "@/components/ui/empty";
import { getSessionUser } from "@/lib/auth/session";
import { getNflScoreboard } from "@/lib/espn/scoreboard";
import {
  resolveScoringRuleDefinitions,
  type ScoringPreset,
} from "@/lib/leagues/scoring";
import { ensureSeasonTeamPublicIds } from "@/lib/leagues/ensure-public-ids";
import {
  getFinalMatchupsForSeason,
  recordsFromFinalMatchups,
} from "@/lib/leagues/matchups/finalize";
import {
  buildScheduleDisplayRows,
  weeklyRanksByWeekFromFinals,
} from "@/lib/leagues/schedule-display";
import { buildTeamH2hSeries } from "@/lib/leagues/team-h2h";
import { myTeamPath } from "@/lib/leagues/utils";
import {
  buildOpponentByTeam,
  resolvePlayerOpponent,
  type TeamMatchup,
} from "@/lib/nfl/matchups";
import { getDraftedRosterForTeam } from "@/lib/queries/draft";
import { getLeagueHomeData } from "@/lib/queries/leagues";
import { getTeamSchedule } from "@/lib/queries/matchups";
import { getRankedPlayers } from "@/lib/queries/players";
import { getTeamStatsCharts } from "@/lib/queries/team-stats-charts";
import { getTeamStatsChartsMock } from "@/lib/leagues/team-stats-charts-mock";
import { getPlayerRosterRatesMap } from "@/lib/queries/player-roster-rates";
import { enrichScheduleWinChances } from "@/lib/queries/schedule-win-chance";
import { getTeamRosterPlayers } from "@/lib/queries/team-roster";
import { getLeagueTeamByPublicId } from "@/lib/queries/team";
import { getUserTeamForLeague } from "@/lib/queries/watchlist";
import { teamInitials } from "@/lib/leagues/standings";
import {
  formatWaiverPriority,
  resolveTeamSummaryMatchups,
  type TeamSummaryScheduleRow,
} from "@/lib/leagues/team-summary";
import { getDefaultScheduleWeek } from "@/lib/nfl/schedule-week";
import { getNflState } from "@/lib/sleeper/api";

type LeagueTeamPageProps = {
  params: Promise<{ leagueId: string; teamId: string }>;
  searchParams: Promise<{ tab?: string; mock?: string }>;
};

export const metadata: Metadata = {
  title: "Team",
};

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
  const { tab, mock } = await searchParams;
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

  const needsRosterPanel = activeTab === "roster";
  const needsStatsPanel = activeTab === "stats";
  const needsSchedulePanel = activeTab === "schedule";
  const needsH2hPanel = activeTab === "head-to-head";
  const needsDraftPicksPanel = activeTab === "draft-picks";

  const needsNflState =
    needsRosterPanel || needsStatsPanel || needsSchedulePanel;
  const needsScoreboard = needsRosterPanel || needsSchedulePanel;
  const needsOtherTeamSchedule = needsRosterPanel || needsSchedulePanel;
  const needsViewerSchedule = needsH2hPanel && Boolean(myTeam);

  const nflStatePromise = needsNflState ? getNflState() : null;

  const [
    rosterPlayers,
    scheduleRows,
    viewerScheduleRows,
    draftPicks,
    nflState,
    scoreboard,
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
    needsDraftPicksPanel
      ? getDraftedRosterForTeam(team.id)
      : Promise.resolve([]),
    nflStatePromise ?? Promise.resolve(null),
    needsScoreboard && nflStatePromise
      ? nflStatePromise
          .then((state) => {
            const week = Math.max(1, Number(state.week) || 1);
            const seasonYear =
              Number(state.season) || new Date().getUTCFullYear();
            return getNflScoreboard({ season: seasonYear, week });
          })
          .catch(() => null)
      : Promise.resolve(null),
    needsSchedulePanel
      ? getFinalMatchupsForSeason(season.id).catch(() => [])
      : Promise.resolve([]),
  ]);

  const rosterPlayerIds = rosterPlayers.map((player) => player.id);
  const nflWeek = Math.max(1, Number(nflState?.week) || 1);
  const nflSeason =
    nflState?.season ?? String(new Date().getUTCFullYear());

  let opponentsByTeam = new Map<string, TeamMatchup>();
  if (scoreboard) {
    opponentsByTeam = buildOpponentByTeam(scoreboard.games);
  }

  const withOpponent = <
    T extends { nflTeam: string | null; byeWeek: number | null },
  >(
    player: T,
  ): T & { opponent: ReturnType<typeof resolvePlayerOpponent> } => ({
    ...player,
    opponent: resolvePlayerOpponent({
      nflTeam: player.nflTeam,
      byeWeek: player.byeWeek,
      week: nflWeek,
      opponentsByTeam,
    }),
  });

  let rosterPanel: ReactNode = null;
  let statsPanel: ReactNode = null;
  let schedulePanel: ReactNode = null;
  let h2hPanel: ReactNode = null;
  let draftPicksPanel: ReactNode = null;

  if (needsRosterPanel) {
    const [rosterRates, weekProjections, weekStats] = await Promise.all([
      getPlayerRosterRatesMap(rosterPlayerIds),
      rosterPlayerIds.length > 0
        ? getRankedPlayers({
            season: nflSeason,
            week: nflWeek,
            kind: "projection",
            scoringRules,
            playerIds: rosterPlayerIds,
          }).catch(() => [])
        : Promise.resolve([]),
      rosterPlayerIds.length > 0
        ? getRankedPlayers({
            season: nflSeason,
            week: nflWeek,
            kind: "stats",
            scoringRules,
            playerIds: rosterPlayerIds,
          }).catch(() => [])
        : Promise.resolve([]),
    ]);

    const projectedById = new Map(
      weekProjections.map((player) => [player.id, player.fantasyPts]),
    );
    const actualById = new Map(
      weekStats.map((player) => [player.id, player.fantasyPts]),
    );

    const rosterPlayersWithRates = rosterPlayers.map((player) => {
      const rates = rosterRates.get(player.id);
      return withOpponent({
        ...player,
        ownedPct: rates?.ownedPct ?? null,
        startPct: rates?.startPct ?? null,
        actualPts: actualById.get(player.id) ?? null,
        projectedPts: projectedById.get(player.id) ?? null,
      });
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
      nflWeek,
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
        players={rosterPlayersWithRates}
        leagueSlug={slug}
        actionsEnabled={false}
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
    const seasonProjections =
      rosterPlayerIds.length > 0
        ? await getRankedPlayers({
            season: nflSeason,
            week: 0,
            kind: "projection",
            scoringRules,
            playerIds: rosterPlayerIds,
          }).catch(() => [])
        : [];
    const charts = useChartsMock
      ? getTeamStatsChartsMock()
      : await getTeamStatsCharts({
          leagueSlug: slug,
          teamId: team.id,
        }).catch(() => null);
    const scoredPlayers = seasonProjections.map((player) =>
      withOpponent(player),
    );
    statsPanel = (
      <TeamStatsSections
        players={scoredPlayers}
        leagueSlug={slug}
        charts={charts}
      />
    );
  }

  if (needsSchedulePanel) {
    const weekRangeByNumber = new Map(
      (scoreboard?.weeks ?? []).map((week) => [week.number, week.rangeLabel]),
    );
    const currentMatchupWeek = scoreboard
      ? getDefaultScheduleWeek(scoreboard.weeks)
      : nflWeek;
    const winChances =
      scheduleRows.length > 0 && nflState
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
            seasonYear: nflState.season,
            currentWeek: currentMatchupWeek,
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
    const draftPickRows = draftPicks.map((pick) => ({
      overall: pick.overall,
      playerName: pick.fullName,
      positionId: pick.primaryPositionId,
      nflTeam: pick.nflTeam,
    }));
    draftPicksPanel = <TeamDraftPicksList picks={draftPickRows} />;
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
