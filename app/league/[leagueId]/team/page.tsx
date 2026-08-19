import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { IrLockAlert } from "@/components/team/ir-lock-alert";
import { MyTeamDraftPicksPanel } from "@/components/team/panels/my-team-draft-picks";
import { MyTeamKeepersPanel } from "@/components/team/panels/my-team-keepers";
import { MyTeamRosterPanel } from "@/components/team/panels/my-team-roster";
import { MyTeamSchedulePanel } from "@/components/team/panels/my-team-schedule";
import { MyTeamSettingsPanel } from "@/components/team/panels/my-team-settings";
import { MyTeamStatsPanel } from "@/components/team/panels/my-team-stats";
import { MyTeamTransactionsPanel } from "@/components/team/panels/my-team-transactions";
import { MyTeamWatchlistPanel } from "@/components/team/panels/my-team-watchlist";
import { TaxiLockAlert } from "@/components/team/taxi-lock-alert";
import {
  myTeamTabsForLeague,
  type MyTeamTabValue,
} from "@/components/team/team-tab-config";
import { TeamTabs } from "@/components/team/team-tabs";
import { WaiverResultsDialog } from "@/components/team/waiver-results-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getSessionUser } from "@/lib/auth/session";
import {
  isLineupEditingEnabled,
  isRosterTransactionsEnabled,
} from "@/lib/leagues/free-agency";
import { canProposeTrades } from "@/lib/leagues/trades/guards";
import { resolveTradePartners } from "@/lib/leagues/trades/partners";
import {
  formatIrLockMessage,
  getIrLockViolations,
  IR_ACQUISITION_LOCK_REASON,
} from "@/lib/leagues/ir-lock";
import {
  resolveScoringRuleDefinitions,
  type ScoringPreset,
} from "@/lib/leagues/scoring";
import { teamInitials } from "@/lib/leagues/standings";
import {
  formatTaxiLockMessage,
  getTaxiLockViolations,
} from "@/lib/leagues/taxi-lock";
import { resolveTaxiMaxYearsExp } from "@/lib/leagues/taxi-eligibility";
import { resolveWaiverWireSettings } from "@/lib/leagues/waiver-wire";
import { isWaiverClaimOrderLocked } from "@/lib/leagues/waivers/calendar";
import { getUnseenTeamWaiverResults } from "@/lib/queries/activity";
import { getLeagueHomeData } from "@/lib/queries/leagues";
import { getIncomingTradeActionCount } from "@/lib/queries/trades";
import {
  ensureTeamRosterSlotsAssigned,
  getTeamRosterPlayers,
} from "@/lib/queries/team-roster";
import { getUserTeamForLeague } from "@/lib/queries/watchlist";
import { parseWeekQueryParam } from "@/lib/leagues/matchup-week";

type MyTeamPageProps = {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ tab?: string; mock?: string; week?: string }>;
};

export async function generateMetadata({
  params,
}: MyTeamPageProps): Promise<Metadata> {
  const { leagueId: slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    return { title: "My Team" };
  }
  const team = await getUserTeamForLeague(slug, user.id);
  return { title: team?.name ?? "My Team" };
}

const TAB_VALUES = new Set<string>(
  myTeamTabsForLeague("dynasty").map((tab) => tab.value),
);

function resolveActiveTab(
  tab: string | undefined,
  leagueType: "redraft" | "dynasty",
): MyTeamTabValue {
  const allowed = new Set(
    myTeamTabsForLeague(leagueType).map((entry) => entry.value),
  );
  if (tab && allowed.has(tab as MyTeamTabValue) && TAB_VALUES.has(tab)) {
    return tab as MyTeamTabValue;
  }
  return "roster";
}

function wrapActivePanel(panel: ReactNode) {
  return <Suspense fallback={<PageSkeleton />}>{panel}</Suspense>;
}

export default async function MyTeamPage({
  params,
  searchParams,
}: MyTeamPageProps) {
  const { leagueId: slug } = await params;
  const { tab, mock, week } = await searchParams;
  const useChartsMock =
    process.env.NODE_ENV === "development" && (mock === "1" || mock === "true");
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

  const activeTab = resolveActiveTab(tab, season.leagueType);

  const scoringPreset = season.scoringPreset as ScoringPreset;
  const scoringRules = resolveScoringRuleDefinitions(
    scoringPreset,
    season.settings.scoringRules,
  );
  const actionsEnabled = isRosterTransactionsEnabled(
    season,
    data.draftStatus,
  );
  const lineupEnabled = isLineupEditingEnabled(season, data.draftStatus);
  const tradesEnabled = canProposeTrades(season).ok;
  const wire = resolveWaiverWireSettings(season.settings.waiverWire);
  const isCommissioner = data.members.some(
    (member) =>
      member.userId === user.id && member.role === "commissioner",
  );

  const [incomingTradeCount, unseenWaiverResults, rosterPlayers] =
    await Promise.all([
      team ? getIncomingTradeActionCount(team.id) : Promise.resolve(0),
      team
        ? getUnseenTeamWaiverResults({
            teamId: team.id,
            lastSeenAt: team.lastWaiverResultsSeenAt,
          })
        : Promise.resolve([]),
      team
        ? ensureTeamRosterSlotsAssigned({
            teamId: team.id,
            rosterSlots: season.settings.rosterSlots,
            benchSlots: season.benchSlots,
            irEnabled: season.irEnabled,
            taxiEnabled: season.taxiEnabled,
            leagueSeasonId: season.id,
            schedule: season.settings.schedule,
            seasonYear: season.seasonYear,
            regularSeasonEndWeek: season.regularSeasonEndWeek,
          }).then(() => getTeamRosterPlayers(team.id))
        : Promise.resolve([]),
    ]);

  const irViolations = getIrLockViolations(
    rosterPlayers,
    season.settings.irEligibleStatuses,
  );
  const taxiViolations = getTaxiLockViolations(
    rosterPlayers,
    resolveTaxiMaxYearsExp(season.settings.taxiMaxYearsExp),
  );
  const acquisitionsLocked =
    irViolations.length > 0 || taxiViolations.length > 0;
  const waiverProcessingLocked =
    season.waiversEnabled && isWaiverClaimOrderLocked(wire);
  const acquisitionLockReason = (() => {
    if (irViolations.length > 0 && taxiViolations.length > 0) {
      return `${formatIrLockMessage(irViolations)} ${formatTaxiLockMessage(taxiViolations)}`;
    }
    if (irViolations.length > 0) {
      return formatIrLockMessage(irViolations);
    }
    if (taxiViolations.length > 0) {
      return formatTaxiLockMessage(taxiViolations);
    }
    return IR_ACQUISITION_LOCK_REASON;
  })();

  let rosterPanel: ReactNode = null;
  let keepersPanel: ReactNode = null;
  let statsPanel: ReactNode = null;
  let watchlistPanel: ReactNode = null;
  let schedulePanel: ReactNode = null;
  let transactionsPanel: ReactNode = null;
  let draftPicksPanel: ReactNode = null;
  let settingsPanel: ReactNode = null;

  if (activeTab === "roster" && team) {
    rosterPanel = wrapActivePanel(
      <MyTeamRosterPanel
        slug={slug}
        user={user}
        team={{
          id: team.id,
          name: team.name,
          publicId: team.publicId,
          slug: team.slug,
          waiverPriority: team.waiverPriority,
        }}
        season={{
          id: season.id,
          seasonYear: season.seasonYear,
          benchSlots: season.benchSlots,
          irEnabled: season.irEnabled,
          irSlots: season.irSlots,
          taxiEnabled: season.taxiEnabled,
          taxiSlots: season.taxiSlots,
          waiversEnabled: season.waiversEnabled,
          tradesEnabled: season.tradesEnabled,
          regularSeasonEndWeek: season.regularSeasonEndWeek,
          settings: {
            rosterSlots: season.settings.rosterSlots,
            irEligibleStatuses: season.settings.irEligibleStatuses,
            taxiMaxYearsExp: season.settings.taxiMaxYearsExp,
            taxiPreventReaddAfterActivation:
              season.settings.taxiPreventReaddAfterActivation,
            schedule: season.settings.schedule,
            transactionRules: season.settings.transactionRules,
          },
        }}
        scoringRules={scoringRules}
        actionsEnabled={actionsEnabled}
        lineupEnabled={lineupEnabled}
        tradesEnabled={tradesEnabled}
        requestedWeek={parseWeekQueryParam(week)}
      />,
    );
  } else if (activeTab === "keepers" && team && season.leagueType === "dynasty") {
    keepersPanel = wrapActivePanel(
      <MyTeamKeepersPanel
        slug={slug}
        teamId={team.id}
        dynasty={season.settings.dynasty}
        rosterSlots={season.settings.rosterSlots}
        benchSlots={season.benchSlots}
        irEnabled={season.irEnabled}
        taxiEnabled={season.taxiEnabled}
      />,
    );
  } else if (activeTab === "stats" && team) {
    statsPanel = wrapActivePanel(
      <MyTeamStatsPanel
        slug={slug}
        teamId={team.id}
        seasonYear={season.seasonYear}
        schedule={season.settings.schedule}
        scoringRules={scoringRules}
        useChartsMock={useChartsMock}
      />,
    );
  } else if (activeTab === "watchlist") {
    watchlistPanel = wrapActivePanel(
      <MyTeamWatchlistPanel
        slug={slug}
        userId={user.id}
        teamId={team?.id ?? null}
        seasonId={season.id}
        seasonYear={season.seasonYear}
        schedule={season.settings.schedule}
        waiversEnabled={season.waiversEnabled}
        scoringRules={scoringRules}
        actionsEnabled={actionsEnabled}
        wire={wire}
        acquisitionsLocked={acquisitionsLocked}
        acquisitionLockReason={acquisitionLockReason}
        waiverProcessingLocked={waiverProcessingLocked}
      />,
    );
  } else if (activeTab === "schedule" && team) {
    schedulePanel = wrapActivePanel(
      <MyTeamSchedulePanel
        slug={slug}
        team={{ id: team.id, slug: team.slug }}
        season={{
          id: season.id,
          seasonYear: season.seasonYear,
          benchSlots: season.benchSlots,
          irEnabled: season.irEnabled,
          irSlots: season.irSlots,
          taxiEnabled: season.taxiEnabled,
          taxiSlots: season.taxiSlots,
          settings: {
            rosterSlots: season.settings.rosterSlots,
            irEligibleStatuses: season.settings.irEligibleStatuses,
            schedule: season.settings.schedule,
          },
        }}
        scoringRules={scoringRules}
      />,
    );
  } else if (activeTab === "transactions" && team) {
    transactionsPanel = wrapActivePanel(
      <MyTeamTransactionsPanel
        slug={slug}
        team={{ id: team.id, faabRemaining: team.faabRemaining }}
        season={{
          id: season.id,
          waiverType: season.waiverType,
          faabBudget: season.faabBudget,
          tradeProcessing: season.tradeProcessing,
          settings: {
            transactionRules: season.settings.transactionRules,
          },
        }}
        wire={wire}
        isCommissioner={isCommissioner}
        partners={resolveTradePartners({
          myTeamId: team.id,
          members: data.members,
          seasonTeams: data.standingsTeams,
        })}
      />,
    );
  } else if (activeTab === "draft-picks" && team) {
    draftPicksPanel = wrapActivePanel(
      <MyTeamDraftPicksPanel
        teamId={team.id}
        leagueSlug={slug}
        leagueId={data.league.id}
        leagueType={season.leagueType}
        seasonYear={season.seasonYear}
        tradesEnabled={tradesEnabled}
        variant="mine"
        partners={resolveTradePartners({
          myTeamId: team.id,
          members: data.members,
          seasonTeams: data.standingsTeams,
        })}
      />,
    );
  } else if (activeTab === "settings" && team) {
    settingsPanel = wrapActivePanel(
      <MyTeamSettingsPanel
        slug={slug}
        team={{
          name: team.name,
          logoUrl: team.logoUrl,
          autoPickEnabled: team.autoPickEnabled,
        }}
      />,
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
      <TaxiLockAlert violations={taxiViolations} />

      <TeamTabs
        defaultTab={activeTab}
        leagueType={season.leagueType}
        transactionsBadge={incomingTradeCount}
        roster={rosterPanel}
        keepers={keepersPanel}
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
