import { TeamTransactionsSection } from "@/components/team/team-transactions-section";
import type { WaiverWireSettings } from "@/db/schema/league-seasons";
import { resolveTransactionRules } from "@/lib/leagues/transaction-rules";
import { resolveFaabRemaining } from "@/lib/leagues/waivers/faab";
import {
  formatWaiverInstantUtc,
  getLastProcessInstantUtc,
  getNextEligibleProcessInstantUtc,
  getWaiverProcessDays,
  isWaiverClaimOrderLocked,
} from "@/lib/leagues/waivers/calendar";
import { resolveClaimProcessInstant } from "@/lib/leagues/waivers/claim-schedule";
import {
  kickoffDateForNflTeam,
  loadNflKickoffsThisWeek,
} from "@/lib/leagues/waivers/nfl-kickoffs";
import {
  getTeamTrades,
  getTradeVetoSummaries,
} from "@/lib/queries/trades";
import {
  getSeasonPendingClaimCount,
  getTeamPendingWaiverClaims,
} from "@/lib/queries/waivers";

export type MyTeamTransactionsPanelProps = {
  slug: string;
  team: {
    id: string;
    faabRemaining: number | null;
  };
  season: {
    id: string;
    waiverType: "priority" | "faab";
    faabBudget: number | null;
    tradeProcessing: string;
    settings: {
      transactionRules: Parameters<typeof resolveTransactionRules>[0];
    };
  };
  wire: WaiverWireSettings;
  isCommissioner: boolean;
};

export async function MyTeamTransactionsPanel({
  slug,
  team,
  season,
  wire,
  isCommissioner,
}: MyTeamTransactionsPanelProps) {
  const teamTradesPromise = getTeamTrades(season.id, team.id);
  const [pendingClaims, pendingSeasonCount, teamTrades, vetoSummaries, kickoffs] =
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
      wire.dailyDropProcessing
        ? loadNflKickoffsThisWeek()
        : Promise.resolve(new Map<string, Date>()),
    ]);

  const claims = pendingClaims
    .map((claim) => {
      const processAt = resolveClaimProcessInstant({
        wire,
        createdAt: claim.createdAt,
        kickoff: kickoffDateForNflTeam(claim.nflTeam, kickoffs),
      });
      return {
        ...claim,
        processAtMs: processAt?.getTime() ?? null,
        processLabel: processAt ? formatWaiverInstantUtc(processAt) : null,
      };
    })
    .toSorted((a, b) => {
      const aMs = a.processAtMs ?? Number.POSITIVE_INFINITY;
      const bMs = b.processAtMs ?? Number.POSITIVE_INFINITY;
      if (aMs !== bMs) return aMs - bMs;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

  const transactionRules = resolveTransactionRules(
    season.settings.transactionRules,
  );
  const processDays = getWaiverProcessDays(wire);
  const nextProcess = getNextEligibleProcessInstantUtc(processDays);
  const nextProcessLabel = nextProcess
    ? formatWaiverInstantUtc(nextProcess)
    : null;
  const lastProcess = getLastProcessInstantUtc(processDays);
  const lastProcessLabel = lastProcess
    ? formatWaiverInstantUtc(lastProcess)
    : null;
  const claimsLocked = isWaiverClaimOrderLocked(wire);

  return (
    <TeamTransactionsSection
      leagueSlug={slug}
      claims={claims}
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
      lastProcessLabel={lastProcessLabel}
      claimsLocked={claimsLocked}
      resetOrderWeekly={wire.resetOrderWeekly}
      fcfsMode={wire.fcfsMode}
      processDays={wire.processDays}
    />
  );
}
