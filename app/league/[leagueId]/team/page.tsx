import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WatchlistProvider } from "@/components/rankings/watchlist-provider";
import { IrLockAlert } from "@/components/team/ir-lock-alert";
import { TeamRosterSections } from "@/components/team/roster-sections";
import { TeamStatsSections } from "@/components/team/stats-sections";
import {
  MY_TEAM_TABS,
  type MyTeamTabValue,
} from "@/components/team/team-tab-config";
import { TeamTabs } from "@/components/team/team-tabs";
import { TeamTransactionsSection } from "@/components/team/team-transactions-section";
import { WaiverResultsDialog } from "@/components/team/waiver-results-dialog";
import { TeamDraftPicksList } from "@/components/team/team-draft-picks-list";
import { TeamScheduleList } from "@/components/team/team-schedule-list";
import { TeamWatchlistSection } from "@/components/team/watchlist-section";
import { TeamSettingsSection } from "@/components/team/team-settings-section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getSessionUser } from "@/lib/auth/session";
import { getNflScoreboard } from "@/lib/espn/scoreboard";
import {
  buildOpponentByTeam,
  resolvePlayerOpponent,
  type TeamMatchup,
} from "@/lib/nfl/matchups";
import { getDefaultScheduleWeek } from "@/lib/nfl/schedule-week";
import { isRosterTransactionsEnabled } from "@/lib/leagues/free-agency";
import { teamInitials } from "@/lib/leagues/standings";
import {
  formatIrLockMessage,
  getIrLockViolations,
  IR_ACQUISITION_LOCK_REASON,
} from "@/lib/leagues/ir-lock";
import {
  resolveScoringRuleDefinitions,
  type ScoringPreset,
} from "@/lib/leagues/scoring";
import { resolveFaabRemaining } from "@/lib/leagues/waivers/faab";
import { resolveWaiverWireSettings } from "@/lib/leagues/waiver-wire";
import { resolveTransactionRules } from "@/lib/leagues/transaction-rules";
import {
  getClaimDeadlineForProcess,
  getLastProcessInstantUtc,
  getNextEligibleProcessInstantUtc,
} from "@/lib/leagues/waivers/calendar";
import { getStartedNflTeamAbbreviations } from "@/lib/leagues/waivers/game-lock";
import { resolvePlayerAcquisitionKind } from "@/lib/leagues/waivers/resolve-kind";
import { getUnseenTeamWaiverResults } from "@/lib/queries/activity";
import { getDraftedRosterForTeam } from "@/lib/queries/draft";
import { getLeagueHomeData } from "@/lib/queries/leagues";
import { getRankedPlayers } from "@/lib/queries/players";
import {
  getLeaguePlayerOwnershipMap,
  getTeamRosteredPlayerIds,
  resolvePlayerOwnership,
} from "@/lib/queries/roster";
import { getTeamRosterPlayers } from "@/lib/queries/team-roster";
import { getPlayerRosterRatesMap } from "@/lib/queries/player-roster-rates";
import {
  getIncomingTradeActionCount,
  getTeamTrades,
  getTradeVetoSummaries,
} from "@/lib/queries/trades";
import {
  getSeasonPendingClaimCount,
  getTeamPendingClaimPlayerIds,
  getTeamPendingWaiverClaims,
} from "@/lib/queries/waivers";
import { getTeamSchedule } from "@/lib/queries/matchups";
import { enrichScheduleWinChances } from "@/lib/queries/schedule-win-chance";
import {
  getLeagueWatchlistPlayerIds,
  getTeamWatchlist,
  getUserTeamForLeague,
} from "@/lib/queries/watchlist";
import { getNflState } from "@/lib/sleeper/api";

type MyTeamPageProps = {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export const metadata: Metadata = {
  title: "My team",
};

const TAB_VALUES = new Set<string>(MY_TEAM_TABS.map((tab) => tab.value));

function resolveActiveTab(tab: string | undefined): MyTeamTabValue {
  if (tab && TAB_VALUES.has(tab)) {
    return tab as MyTeamTabValue;
  }
  return "roster";
}

export default async function MyTeamPage({
  params,
  searchParams,
}: MyTeamPageProps) {
  const { leagueId: slug } = await params;
  const { tab } = await searchParams;
  const activeTab = resolveActiveTab(tab);
  const user = await getSessionUser();

  if (!user) {
    redirect(`/login?next=/league/${slug}/team`);
  }

  const [data, team] = await Promise.all([
    getLeagueHomeData(slug, user.id),
    getUserTeamForLeague(slug, user.id),
  ]);
  if (!data || !data.isMember) {
    redirect("/leagues");
  }

  const season = data.season;
  if (!season) {
    redirect("/leagues");
  }

  const scoringPreset = season.scoringPreset as ScoringPreset;
  const scoringRules = resolveScoringRuleDefinitions(
    scoringPreset,
    season.settings.scoringRules,
  );
  const actionsEnabled = isRosterTransactionsEnabled(season);
  const wire = resolveWaiverWireSettings(season.settings.waiverWire);
  const isCommissioner = data.members.some(
    (member) =>
      member.userId === user.id && member.role === "commissioner",
  );

  const needsRosterPanel = activeTab === "roster";
  const needsStatsPanel = activeTab === "stats";
  const needsWatchlistPanel = activeTab === "watchlist";
  const needsSchedulePanel = activeTab === "schedule";
  const needsTransactionsPanel = activeTab === "transactions";
  const needsDraftPicksPanel = activeTab === "draft-picks";
  const needsSettingsPanel = activeTab === "settings";

  // Light roster load for IR banner on tabs that can acquire players.
  const needsRosterForIr =
    needsRosterPanel || needsWatchlistPanel || needsTransactionsPanel;
  const needsNflState =
    needsRosterPanel ||
    needsStatsPanel ||
    needsWatchlistPanel ||
    needsSchedulePanel;
  const needsScoreboard =
    needsRosterPanel || needsWatchlistPanel || needsSchedulePanel;

  const nflStatePromise =
    needsNflState || needsScoreboard ? getNflState() : null;

  const [
    incomingTradeCount,
    unseenWaiverResults,
    rosterPlayers,
    nflState,
    scoreboard,
  ] = await Promise.all([
    team ? getIncomingTradeActionCount(team.id) : Promise.resolve(0),
    team
      ? getUnseenTeamWaiverResults({
          teamId: team.id,
          lastSeenAt: team.lastWaiverResultsSeenAt,
        })
      : Promise.resolve([]),
    team && needsRosterForIr
      ? getTeamRosterPlayers(team.id)
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
  ]);

  const nflWeek = Math.max(1, Number(nflState?.week) || 1);
  const nflSeason = nflState?.season ?? String(new Date().getUTCFullYear());

  let startedNflTeams = new Set<string>();
  let opponentsByTeam = new Map<string, TeamMatchup>();
  if (scoreboard) {
    opponentsByTeam = buildOpponentByTeam(scoreboard.games);
    if (
      season.waiversEnabled &&
      wire.waiverPool === "drops_and_free_agents" &&
      actionsEnabled
    ) {
      startedNflTeams = getStartedNflTeamAbbreviations(scoreboard.games);
    }
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

  const irViolations = getIrLockViolations(
    rosterPlayers,
    season.settings.irEligibleStatuses,
  );
  const acquisitionsLocked = irViolations.length > 0;
  const acquisitionLockReason = acquisitionsLocked
    ? formatIrLockMessage(irViolations)
    : IR_ACQUISITION_LOCK_REASON;

  let rosterPanel = null;
  let statsPanel = null;
  let watchlistPanel = null;
  let schedulePanel = null;
  let transactionsPanel = null;
  let draftPicksPanel = null;
  let settingsPanel = null;

  if (needsRosterPanel && team) {
    const ratePlayerIds = rosterPlayers.map((player) => player.id);
    const [rosterRates, weekProjections, weekStats] = await Promise.all([
      getPlayerRosterRatesMap(ratePlayerIds),
      getRankedPlayers({
        season: nflSeason,
        week: nflWeek,
        kind: "projection",
        scoringRules,
        playerIds: ratePlayerIds,
      }).catch(() => []),
      getRankedPlayers({
        season: nflSeason,
        week: nflWeek,
        kind: "stats",
        scoringRules,
        playerIds: ratePlayerIds,
      }).catch(() => []),
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
        actualPts: actualById.get(player.id) ?? null,
        projectedPts: projectedById.get(player.id) ?? null,
        ownedPct: rates?.ownedPct ?? null,
        startPct: rates?.startPct ?? null,
      });
    });
    rosterPanel = (
      <TeamRosterSections
        rosterSlots={season.settings.rosterSlots}
        benchSlots={season.benchSlots}
        irEnabled={season.irEnabled}
        irSlots={season.irSlots}
        irEligibleStatuses={season.settings.irEligibleStatuses}
        taxiEnabled={season.taxiEnabled}
        taxiSlots={season.taxiSlots}
        players={rosterPlayersWithRates}
        leagueSlug={slug}
        actionsEnabled={actionsEnabled}
        tradesEnabled={season.tradesEnabled && actionsEnabled}
      />
    );
  }

  if (needsStatsPanel && team) {
    const rosterIds =
      rosterPlayers.length > 0
        ? rosterPlayers.map((player) => player.id)
        : await getTeamRosteredPlayerIds(team.id);
    const seasonProjections =
      rosterIds.length > 0
        ? await getRankedPlayers({
            season: nflSeason,
            week: 0,
            kind: "projection",
            scoringRules,
            playerIds: rosterIds,
          }).catch(() => [])
        : [];
    const rosterIdSet = new Set(rosterIds);
    const scoredPlayers = seasonProjections
      .filter((player) => rosterIdSet.has(player.id))
      .map(withOpponent);
    statsPanel = (
      <TeamStatsSections players={scoredPlayers} leagueSlug={slug} />
    );
  }

  if (needsWatchlistPanel) {
    const [watchlistPlayers, watchlistIds, ownershipMap, pendingClaimPlayerIds] =
      await Promise.all([
        team ? getTeamWatchlist(team.id) : Promise.resolve([]),
        getLeagueWatchlistPlayerIds(slug, user.id),
        getLeaguePlayerOwnershipMap(season.id, user.id).catch(() => new Map()),
        team ? getTeamPendingClaimPlayerIds(team.id) : Promise.resolve([]),
      ]);
    const pendingClaimIdSet = new Set(pendingClaimPlayerIds);
    const ratePlayerIds = [
      ...new Set([
        ...rosterPlayers.map((player) => player.id),
        ...watchlistPlayers.map((player) => player.id),
      ]),
    ];
    const [rosterRates, weekProjections, weekStats] = await Promise.all([
      getPlayerRosterRatesMap(ratePlayerIds),
      getRankedPlayers({
        season: nflSeason,
        week: nflWeek,
        kind: "projection",
        scoringRules,
        playerIds: ratePlayerIds,
      }).catch(() => []),
      getRankedPlayers({
        season: nflSeason,
        week: nflWeek,
        kind: "stats",
        scoringRules,
        playerIds: ratePlayerIds,
      }).catch(() => []),
    ]);
    const projectedById = new Map(
      weekProjections.map((player) => [player.id, player.fantasyPts]),
    );
    const actualById = new Map(
      weekStats.map((player) => [player.id, player.fantasyPts]),
    );
    const playersWithOwnership = watchlistPlayers.map((player) => {
      const ownership = resolvePlayerOwnership(ownershipMap, player.id);
      const rates = rosterRates.get(player.id);
      const acquisitionKind = resolvePlayerAcquisitionKind({
        waiversEnabled: season.waiversEnabled,
        waiverWire: wire,
        rosterTransactionsEnabled: actionsEnabled,
        fantasyTeamId: ownership.fantasyTeamId,
        onWaivers: ownership.onWaivers,
        nflTeam: player.nflTeam,
        startedNflTeams,
      });
      return withOpponent({
        ...player,
        fantasyTeamId: ownership.fantasyTeamId,
        fantasyTeamName: ownership.fantasyTeamName,
        isOwnedByCurrentUser: ownership.isOwnedByCurrentUser,
        onWaivers: ownership.onWaivers,
        acquisitionKind,
        hasPendingClaim: pendingClaimIdSet.has(player.id),
        ownedPct: rates?.ownedPct ?? null,
        startPct: rates?.startPct ?? null,
        actualPts: actualById.get(player.id) ?? null,
        projectedPts: projectedById.get(player.id) ?? null,
      });
    });
    watchlistPanel = (
      <WatchlistProvider leagueSlug={slug} initialPlayerIds={watchlistIds}>
        <TeamWatchlistSection
          players={playersWithOwnership}
          leagueSlug={slug}
          actionsEnabled={actionsEnabled}
          acquisitionsLocked={acquisitionsLocked}
          acquisitionLockReason={acquisitionLockReason}
        />
      </WatchlistProvider>
    );
  }

  if (needsSchedulePanel && team && nflState) {
    const scheduleRows = await getTeamSchedule(season.id, team.id);
    const weekRangeByNumber = new Map(
      (scoreboard?.weeks ?? []).map((week) => [week.number, week.rangeLabel]),
    );
    const currentMatchupWeek = scoreboard
      ? getDefaultScheduleWeek(scoreboard.weeks)
      : nflWeek;
    const winChances =
      scheduleRows.length > 0
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
    const scheduleDisplayRows = scheduleRows.map((row) => ({
      ...row,
      weekRangeLabel: weekRangeByNumber.get(row.week) ?? "",
      opponentWins: 0,
      opponentLosses: 0,
      opponentTies: 0,
      result: null as "win" | "loss" | "tie" | null,
      weeklyRank: null as number | null,
      winChance: winChances.get(row.id) ?? null,
    }));
    schedulePanel = (
      <TeamScheduleList
        rows={scheduleDisplayRows}
        leagueSlug={slug}
        myTeamSlug={team.slug ?? null}
      />
    );
  }

  if (needsTransactionsPanel && team) {
    const teamTradesPromise = getTeamTrades(season.id, team.id);
    const [pendingClaims, pendingSeasonCount, teamTrades, vetoSummaries] =
      await Promise.all([
        getTeamPendingWaiverClaims(team.id),
        getSeasonPendingClaimCount(season.id),
        teamTradesPromise,
        teamTradesPromise.then(async (trades) => {
          const reviewTradeIds = trades
            .filter((trade) => trade.status === "review")
            .map((trade) => trade.id);
          return Object.fromEntries(
            await getTradeVetoSummaries({
              tradeIds: reviewTradeIds,
              leagueSeasonId: season.id,
              myTeamId: team.id,
            }),
          );
        }),
      ]);
    const transactionRules = resolveTransactionRules(
      season.settings.transactionRules,
    );
    const nextProcess = getNextEligibleProcessInstantUtc(wire.processDays);
    const nextProcessLabel = nextProcess
      ? nextProcess.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "")
      : null;
    const claimDeadline = nextProcess
      ? getClaimDeadlineForProcess(nextProcess)
      : null;
    const claimDeadlineLabel = claimDeadline
      ? claimDeadline.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "")
      : null;
    const lastProcess = getLastProcessInstantUtc(wire.processDays);
    const lastProcessLabel = lastProcess
      ? lastProcess.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "")
      : null;
    transactionsPanel = (
      <TeamTransactionsSection
        leagueSlug={slug}
        claims={pendingClaims}
        trades={teamTrades}
        myTeamId={team.id}
        isCommissioner={isCommissioner}
        tradeProcessing={season.tradeProcessing}
        allowVetoes={transactionRules.allowVetoes}
        vetoSummaries={vetoSummaries}
        waiverType={season.waiverType}
        faabRemaining={resolveFaabRemaining(
          team.faabRemaining,
          season.faabBudget,
        )}
        allowZeroBids={wire.allowZeroBids}
        pendingSeasonCount={pendingSeasonCount}
        nextProcessLabel={nextProcessLabel}
        claimDeadlineLabel={claimDeadlineLabel}
        lastProcessLabel={lastProcessLabel}
        resetOrderWeekly={wire.resetOrderWeekly}
        fcfsMode={wire.fcfsMode}
        processDays={wire.processDays}
      />
    );
  }

  if (needsDraftPicksPanel && team) {
    const draftedPicks = await getDraftedRosterForTeam(team.id);
    draftPicksPanel = (
      <TeamDraftPicksList
        picks={draftedPicks.map((pick) => ({
          overall: pick.overall,
          playerName: pick.fullName,
          positionId: pick.primaryPositionId,
          nflTeam: pick.nflTeam,
        }))}
      />
    );
  }

  if (needsSettingsPanel && team) {
    settingsPanel = (
      <TeamSettingsSection
        leagueSlug={slug}
        initialLogoUrl={team.logoUrl ?? null}
        initialAutoPickEnabled={team.autoPickEnabled}
        initialValues={{
          name: team.name,
          logoMode: "keep",
          logoUrl: team.logoUrl ?? "",
        }}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Avatar size="lg" className="shrink-0">
          {team?.logoUrl ? <AvatarImage src={team.logoUrl} alt="" /> : null}
          <AvatarFallback>
            {teamInitials(team?.name ?? data.league.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-0">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            My Team
          </h1>
          <p className="text-sm text-pretty text-muted-foreground">
            {team?.name ?? data.league.name}
          </p>
        </div>
      </div>

      <WaiverResultsDialog
        leagueSlug={slug}
        results={unseenWaiverResults}
        waiverType={season.waiverType}
      />

      <IrLockAlert violations={irViolations} />

      <TeamTabs
        defaultTab={activeTab}
        transactionsBadge={incomingTradeCount}
        roster={rosterPanel}
        stats={statsPanel}
        watchlist={watchlistPanel}
        schedule={schedulePanel}
        transactions={transactionsPanel}
        draft-picks={draftPicksPanel}
        settings={settingsPanel}
      />
    </div>
  );
}
