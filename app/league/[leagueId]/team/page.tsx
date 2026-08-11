import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { IrLockAlert } from "@/components/team/ir-lock-alert";
import { MyTeamDraftPicksPanel } from "@/components/team/panels/my-team-draft-picks";
import { MyTeamRosterPanel } from "@/components/team/panels/my-team-roster";
import { MyTeamSchedulePanel } from "@/components/team/panels/my-team-schedule";
import { MyTeamSettingsPanel } from "@/components/team/panels/my-team-settings";
import { MyTeamStatsPanel } from "@/components/team/panels/my-team-stats";
import { MyTeamTransactionsPanel } from "@/components/team/panels/my-team-transactions";
import { MyTeamWatchlistPanel } from "@/components/team/panels/my-team-watchlist";
import { TaxiLockAlert } from "@/components/team/taxi-lock-alert";
import {
  MY_TEAM_TABS,
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
import { getUnseenTeamWaiverResults } from "@/lib/queries/activity";
import { getLeagueHomeData } from "@/lib/queries/leagues";
import { getIncomingTradeActionCount } from "@/lib/queries/trades";
import {
  ensureTeamRosterSlotsAssigned,
  getTeamRosterPlayers,
} from "@/lib/queries/team-roster";
import { getUserTeamForLeague } from "@/lib/queries/watchlist";

type MyTeamPageProps = {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ tab?: string; mock?: string }>;
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

const TAB_VALUES = new Set<string>(MY_TEAM_TABS.map((tab) => tab.value));

function resolveActiveTab(tab: string | undefined): MyTeamTabValue {
  if (tab && TAB_VALUES.has(tab)) {
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
  const { tab, mock } = await searchParams;
  const useChartsMock =
    process.env.NODE_ENV === "development" && (mock === "1" || mock === "true");
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
          settings: {
            rosterSlots: season.settings.rosterSlots,
            irEligibleStatuses: season.settings.irEligibleStatuses,
            taxiMaxYearsExp: season.settings.taxiMaxYearsExp,
            taxiPreventReaddAfterActivation:
              season.settings.taxiPreventReaddAfterActivation,
            schedule: season.settings.schedule,
          },
        }}
        scoringRules={scoringRules}
        actionsEnabled={actionsEnabled}
        lineupEnabled={lineupEnabled}
        tradesEnabled={tradesEnabled}
        wire={wire}
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
      />,
    );
  } else if (activeTab === "draft-picks" && team) {
    draftPicksPanel = wrapActivePanel(
      <MyTeamDraftPicksPanel teamId={team.id} leagueSlug={slug} />,
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
