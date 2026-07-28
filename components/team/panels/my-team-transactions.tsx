import { TeamTransactionsSection } from "@/components/team/team-transactions-section";
import type { WaiverWireSettings } from "@/db/schema/league-seasons";
import { resolveTransactionRules } from "@/lib/leagues/transaction-rules";
import { resolveFaabRemaining } from "@/lib/leagues/waivers/faab";
import {
  getClaimDeadlineForProcess,
  getLastProcessInstantUtc,
  getNextEligibleProcessInstantUtc,
} from "@/lib/leagues/waivers/calendar";
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

  return (
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
