import type { Metadata } from "next";
import { after } from "next/server";
import { redirect } from "next/navigation";

import { UserSwitchIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { ProposeTradeDialog } from "@/components/trades/propose-trade-dialog";
import { TradeHistory } from "@/components/trades/trade-history";
import { TradeList } from "@/components/trades/trade-list";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { processReadyTrades } from "@/lib/actions/trades";
import { getSessionUser } from "@/lib/auth/session";
import { canProposeTrades } from "@/lib/leagues/trades/guards";
import { resolveTradePartners } from "@/lib/leagues/trades/partners";
import { resolveTransactionRules } from "@/lib/leagues/transaction-rules";
import { getLeagueHomeData } from "@/lib/queries/leagues";
import { getLeagueTrades, getTradeVetoSummaries } from "@/lib/queries/trades";
import { getUserTeamForLeague } from "@/lib/queries/watchlist";

type TradesPageProps = {
  params: Promise<{ leagueId: string }>;
};

export const metadata: Metadata = {
  title: "Trades",
};

export default async function TradesPage({ params }: TradesPageProps) {
  const { leagueId: slug } = await params;
  const user = await getSessionUser();

  if (!user) {
    redirect(`/login?next=/league/${slug}/trades`);
  }

  const [data, team] = await Promise.all([
    getLeagueHomeData(slug, user.id),
    getUserTeamForLeague(slug, user.id),
  ]);

  if (!data || !data.isMember || !data.season || !team) {
    redirect("/leagues");
  }

  const season = data.season;
  after(() => {
    void processReadyTrades(slug);
  });

  const trades = await getLeagueTrades(season.id, team.id);
  const transactionRules = resolveTransactionRules(
    season.settings.transactionRules,
  );
  const reviewTradeIds = trades
    .filter((trade) => trade.status === "review")
    .map((trade) => trade.id);
  const vetoMap = await getTradeVetoSummaries({
    tradeIds: reviewTradeIds,
    leagueSeasonId: season.id,
    myTeamId: team.id,
  });
  const vetoSummaries = Object.fromEntries(vetoMap);
  const isCommissioner = data.members.some(
    (member) => member.userId === user.id && member.role === "commissioner",
  );
  const proposeGate = canProposeTrades(season);
  const partners = resolveTradePartners({
    myTeamId: team.id,
    members: data.members,
    seasonTeams: data.standingsTeams,
  });

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2 sm:gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Trades
        </h1>
        {proposeGate.ok && trades.length > 0 ? (
          <ProposeTradeDialog leagueSlug={slug} partners={partners} />
        ) : null}
      </div>

      {!proposeGate.ok ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={UserSwitchIcon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>Trades unavailable</EmptyTitle>
            <EmptyDescription>{proposeGate.error}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : trades.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={UserSwitchIcon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>No open trades right now</EmptyTitle>
            <EmptyDescription>
              Propose a trade when you are ready to shake up your roster.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <ProposeTradeDialog
              leagueSlug={slug}
              partners={partners}
              label="Propose Trade"
            />
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <section className="flex flex-col gap-3 sm:gap-4">
            <h2 className="text-lg font-semibold tracking-tight text-balance">
              Open Trades
            </h2>
            <TradeList
              leagueSlug={slug}
              trades={trades}
              myTeamId={team.id}
              isCommissioner={isCommissioner}
              tradeProcessing={season.tradeProcessing}
              allowVetoes={transactionRules.allowVetoes}
              vetoSummaries={vetoSummaries}
            />
          </section>

          <TradeHistory trades={trades} myTeamId={team.id} leagueSlug={slug} />
        </>
      )}
    </div>
  );
}
