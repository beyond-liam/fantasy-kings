import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TradeComposer } from "@/components/trades/trade-composer";
import { getSessionUser } from "@/lib/auth/session";
import {
  resolveScoringRuleDefinitions,
  type ScoringPreset,
} from "@/lib/leagues/scoring";
import { canProposeTrades } from "@/lib/leagues/trades/guards";
import {
  parseTradeComposerIds,
  tradeComposerPath,
} from "@/lib/leagues/utils";
import { getLeagueHomeData } from "@/lib/queries/leagues";
import { getTradeById, getTradeComposerRoster } from "@/lib/queries/trades";
import { getUserTeamForLeague } from "@/lib/queries/watchlist";
import { getNflState } from "@/lib/sleeper/api";

type NewTradePageProps = {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{
    with?: string;
    want?: string;
    offer?: string;
    counter?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Propose trade",
};

export default async function NewTradePage({
  params,
  searchParams,
}: NewTradePageProps) {
  const { leagueId: slug } = await params;
  const query = await searchParams;

  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/trades/new`);
  }

  const [data, team] = await Promise.all([
    getLeagueHomeData(slug, user.id),
    getUserTeamForLeague(slug, user.id),
  ]);

  if (!data || !data.isMember || !data.season || !team) {
    redirect("/leagues");
  }

  const season = data.season;
  const proposeGate = canProposeTrades(season);
  if (!proposeGate.ok) {
    redirect(`/league/${slug}/trades`);
  }

  const partners = data.members
    .filter((member) => member.teamId && member.teamId !== team.id)
    .map((member) => ({
      id: member.teamId!,
      name: member.teamName ?? "Team",
      slug: member.teamSlug ?? member.teamId!,
    }));

  if (partners.length === 0) {
    redirect(`/league/${slug}/trades`);
  }

  let counterOfTradeId: string | null = null;
  let partnerIdFromCounter: string | null = null;

  if (query.counter) {
    const original = await getTradeById(query.counter);
    if (
      !original ||
      original.leagueSeasonId !== season.id ||
      original.status !== "pending" ||
      original.receivingTeamId !== team.id
    ) {
      redirect(`/league/${slug}/trades`);
    }
    counterOfTradeId = original.id;
    partnerIdFromCounter = original.proposingTeamId;
  }

  const initialPartner =
    (partnerIdFromCounter
      ? partners.find((partner) => partner.id === partnerIdFromCounter)
      : null) ??
    partners.find((partner) => partner.slug === query.with) ??
    null;

  if (!initialPartner) {
    if (partners.length === 1 && !counterOfTradeId) {
      redirect(
        tradeComposerPath(slug, {
          with: partners[0]!.slug,
          want: query.want,
          offer: query.offer,
        }),
      );
    }
    redirect(`/league/${slug}/trades`);
  }

  if (
    partnerIdFromCounter &&
    initialPartner.id !== partnerIdFromCounter
  ) {
    redirect(`/league/${slug}/trades`);
  }

  const nflState = await getNflState().catch(() => ({
    season: String(season.seasonYear),
  }));

  const scoringPreset = season.scoringPreset as ScoringPreset;
  const scoringRules = resolveScoringRuleDefinitions(
    scoringPreset,
    season.settings.scoringRules,
  );

  const [myRoster, partnerRoster] = await Promise.all([
    getTradeComposerRoster({
      teamId: team.id,
      seasonYear: nflState.season,
      scoringRules,
    }),
    getTradeComposerRoster({
      teamId: initialPartner.id,
      seasonYear: nflState.season,
      scoringRules,
    }),
  ]);

  // Drop IDs that are no longer on the roster (e.g. waived since propose).
  // Still open the composer — especially for counter-offers.
  const initialWantIds = parseTradeComposerIds(query.want).filter((id) =>
    partnerRoster.some((player) => player.id === id),
  );
  const initialOfferIds = parseTradeComposerIds(query.offer).filter((id) =>
    myRoster.some((player) => player.id === id),
  );

  return (
    <div className="flex flex-1 flex-col p-4">
      <TradeComposer
        key={`${initialPartner.id}:${initialWantIds.join(",")}:${initialOfferIds.join(",")}:${counterOfTradeId ?? ""}`}
        leagueSlug={slug}
        myTeam={{ id: team.id, name: team.name }}
        partner={initialPartner}
        myRoster={myRoster}
        partnerRoster={partnerRoster}
        initialWantIds={initialWantIds}
        initialOfferIds={initialOfferIds}
        counterOfTradeId={counterOfTradeId}
        rosterSlots={season.settings.rosterSlots}
        benchSlots={season.benchSlots}
      />
    </div>
  );
}
