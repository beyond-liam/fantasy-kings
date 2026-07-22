"use client";

import { TradeHistory } from "@/components/trades/trade-history";
import { TradeList } from "@/components/trades/trade-list";
import { PendingTradePropose } from "@/components/trades/pending-trade-propose";
import { TeamWaiversSection } from "@/components/team/team-waivers-section";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { WaiverProcessDay } from "@/db/schema/league-seasons";
import { OPEN_TRADE_STATUSES } from "@/lib/leagues/trades/guards";
import type { PendingWaiverClaimRow } from "@/lib/queries/waivers";
import type { TradeListRow, TradeVetoSummary } from "@/lib/queries/trades";

type TeamTransactionsSectionProps = {
  leagueSlug: string;
  claims: PendingWaiverClaimRow[];
  trades: TradeListRow[];
  myTeamId: string;
  isCommissioner: boolean;
  tradeProcessing: string;
  allowVetoes?: boolean;
  vetoSummaries?: Record<string, TradeVetoSummary>;
  waiverType: "priority" | "faab";
  faabRemaining: number | null;
  allowZeroBids: boolean;
  pendingSeasonCount: number;
  nextProcessLabel: string | null;
  claimDeadlineLabel: string | null;
  lastProcessLabel: string | null;
  resetOrderWeekly: boolean;
  fcfsMode: "after_process" | "never";
  processDays: WaiverProcessDay[];
};

const OPEN_STATUS_SET = new Set<string>(OPEN_TRADE_STATUSES);

function involvesTeam(trade: TradeListRow, teamId: string) {
  return (
    trade.proposingTeamId === teamId || trade.receivingTeamId === teamId
  );
}

export function TeamTransactionsSection({
  leagueSlug,
  claims,
  trades,
  myTeamId,
  isCommissioner,
  tradeProcessing,
  allowVetoes,
  vetoSummaries,
  waiverType,
  faabRemaining,
  allowZeroBids,
  pendingSeasonCount,
  nextProcessLabel,
  claimDeadlineLabel,
  lastProcessLabel,
  resetOrderWeekly,
  fcfsMode,
  processDays,
}: TeamTransactionsSectionProps) {
  // Team page is scoped to this roster only — never show other teams' deals.
  const myTrades = trades.filter((trade) => involvesTeam(trade, myTeamId));
  const openTradeCount = myTrades.filter((trade) =>
    OPEN_STATUS_SET.has(trade.status),
  ).length;
  const claimCount = claims.length;
  const defaultTab = "waivers";

  return (
    <div className="flex flex-col gap-6">
      <PendingTradePropose leagueSlug={leagueSlug} />

      <Tabs defaultValue={defaultTab} className="gap-6">
        <TabsList variant="line">
          <TabsTrigger value="waivers" className="gap-2">
            Waivers
            {claimCount > 0 ? (
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                {claimCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="trades" className="gap-2">
            Trades
            {openTradeCount > 0 ? (
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                {openTradeCount}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="waivers">
          <TeamWaiversSection
            leagueSlug={leagueSlug}
            claims={claims}
            waiverType={waiverType}
            faabRemaining={faabRemaining}
            allowZeroBids={allowZeroBids}
            isCommissioner={isCommissioner}
            pendingSeasonCount={pendingSeasonCount}
            nextProcessLabel={nextProcessLabel}
            claimDeadlineLabel={claimDeadlineLabel}
            lastProcessLabel={lastProcessLabel}
            resetOrderWeekly={resetOrderWeekly}
            fcfsMode={fcfsMode}
            processDays={processDays}
          />
        </TabsContent>

        <TabsContent value="trades" className="flex flex-col gap-8">
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold tracking-tight text-balance">
              Open Trades
            </h2>
            <TradeList
              leagueSlug={leagueSlug}
              trades={myTrades}
              myTeamId={myTeamId}
              isCommissioner={isCommissioner}
              tradeProcessing={tradeProcessing}
              allowVetoes={allowVetoes}
              vetoSummaries={vetoSummaries}
            />
          </section>

          <TradeHistory trades={myTrades} myTeamId={myTeamId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
