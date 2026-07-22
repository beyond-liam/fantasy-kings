import type { Metadata } from "next";
import { after } from "next/server";
import { redirect } from "next/navigation";

import { ProposeTradeDialog } from "@/components/trades/propose-trade-dialog";
import { TradeHistory } from "@/components/trades/trade-history";
import { TradeList } from "@/components/trades/trade-list";
import { processReadyTrades } from "@/lib/actions/trades";
import { getSessionUser } from "@/lib/auth/session";
import { canProposeTrades } from "@/lib/leagues/trades/guards";
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

  const trades = await getLeagueTrades(season.id);
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
  const partners = data.members
    .filter((member) => member.teamId && member.teamId !== team.id)
    .map((member) => ({
      id: member.teamId!,
      name: member.teamName ?? "Team",
      slug: member.teamSlug ?? member.teamId!,
    }));

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Trades
        </h1>
        {proposeGate.ok ? (
          <ProposeTradeDialog leagueSlug={slug} partners={partners} />
        ) : null}
      </div>

      {!proposeGate.ok ? (
        <p className="text-sm text-muted-foreground">{proposeGate.error}</p>
      ) : null}

      <section className="flex flex-col gap-4">
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

      <TradeHistory trades={trades} myTeamId={team.id} />
    </div>
  );
}
