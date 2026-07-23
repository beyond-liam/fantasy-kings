"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { teams, tradePlayers, waiverClaims } from "@/db/schema";
import { db } from "@/lib/db";
import {
  formatIrLockMessage,
  getIrLockViolations,
} from "@/lib/leagues/ir-lock";
import { loadLeagueMemberTeamContext } from "@/lib/leagues/action-context";
import type { LeagueMemberTeamContext } from "@/lib/leagues/action-context";
import { resolveTransactionRules } from "@/lib/leagues/transaction-rules";
import {
  canProposeTrades,
  isTradeDeadlinePassed,
  tradeDeadlineError,
} from "@/lib/leagues/trades/guards";
import {
  acceptTradeOffer,
  approveTradeByCommissioner,
  cancelTradeOffer,
  castTradeVeto,
  completeExpiredTrade,
  commitTradeProposal,
  countSeasonTeams,
  hasTeamVotedVeto,
  rejectTradeByCommissioner,
  rejectTradeOffer,
} from "@/lib/leagues/trades/lifecycle";
import {
  resolveNextStatusOnAccept,
  reviewEndsAtFromNow,
} from "@/lib/leagues/trades/status";
import {
  isDropPlayerSelectable,
  listDropCandidates,
  validateTradeProposal,
} from "@/lib/leagues/trades/validate";
import { resolveWaiverWireSettings } from "@/lib/leagues/waiver-wire";
import {
  getExpiredReviewTrades,
  getTradeById,
  listRosterPlayerRows,
  toTradeRosterPlayers,
} from "@/lib/queries/trades";
import { getTeamRosterPlayers } from "@/lib/queries/team-roster";
import { getNflState } from "@/lib/sleeper/api";

export type TradeActionResult = {
  success: boolean;
  error?: string;
  errors?: string[];
};

type TradeContext = Awaited<ReturnType<typeof loadLeagueMemberTeamContext>>;

async function getTradeContext(slug: string): Promise<TradeContext> {
  return loadLeagueMemberTeamContext(slug);
}

function revalidateTradePaths(slug: string) {
  revalidatePath(`/league/${slug}/trades`);
  revalidatePath(`/league/${slug}/trades/new`);
  revalidatePath(`/league/${slug}/team`);
  revalidatePath(`/league/${slug}/activity`);
}

async function assertCanPropose(season: LeagueMemberTeamContext["season"]) {
  const gate = canProposeTrades(season);
  if (!gate.ok) {
    return gate.error;
  }

  const nflState = await getNflState().catch(() => ({ week: 1 }));
  const currentWeek = Math.max(1, Number(nflState.week) || 1);
  if (isTradeDeadlinePassed(currentWeek, season.tradeDeadlineWeek)) {
    return tradeDeadlineError(season.tradeDeadlineWeek!);
  }

  return null;
}

async function assertNoIrLock(teamId: string, irEligibleStatuses: readonly string[] | null | undefined) {
  const roster = await getTeamRosterPlayers(teamId);
  const violations = getIrLockViolations(roster, irEligibleStatuses);
  if (violations.length > 0) {
    return formatIrLockMessage(violations);
  }
  return null;
}

async function assertPlayersAvailable(
  playerIds: string[],
  teamId: string,
) {
  if (playerIds.length === 0) {
    return null;
  }

  const pendingClaims = await db
    .select({ playerId: waiverClaims.playerId })
    .from(waiverClaims)
    .where(
      and(
        eq(waiverClaims.teamId, teamId),
        eq(waiverClaims.status, "pending"),
        inArray(waiverClaims.playerId, playerIds),
      ),
    );
  if (pendingClaims.length > 0) {
    return "A selected player has a pending waiver claim.";
  }

  return null;
}

export type TradeAcceptCandidate = {
  id: string;
  fullName: string;
  primaryPositionId: string;
  nflTeam: string | null;
};

export type TradeAcceptPreviewResult =
  | { ok: true; preview: { dropsNeeded: number; candidates: TradeAcceptCandidate[] } }
  | { ok: false; error: string };

export async function getTradeAcceptPreview(
  slug: string,
  tradeId: string,
): Promise<TradeAcceptPreviewResult> {
  const loaded = await getTradeForAction(slug, tradeId);
  if ("error" in loaded) {
    return { ok: false, error: loaded.error };
  }

  const { context, trade } = loaded;
  const { season, team } = context;

  if (trade.status !== "pending") {
    return { ok: false, error: "This trade is no longer pending." };
  }

  if (trade.receivingTeamId !== team.id) {
    return { ok: false, error: "Only the receiving team can accept." };
  }

  const tradePlayerRows = await db
    .select({
      teamId: tradePlayers.teamId,
      playerId: tradePlayers.playerId,
      isDrop: tradePlayers.isDrop,
    })
    .from(tradePlayers)
    .where(eq(tradePlayers.tradeId, tradeId));

  const proposingOfferIds = tradePlayerRows
    .filter((row) => row.teamId === trade.proposingTeamId && !row.isDrop)
    .map((row) => row.playerId);
  const receivingOfferIds = tradePlayerRows
    .filter((row) => row.teamId === trade.receivingTeamId && !row.isDrop)
    .map((row) => row.playerId);

  const [proposingRoster, receivingRoster] = await Promise.all([
    toTradeRosterPlayers(trade.proposingTeamId),
    toTradeRosterPlayers(trade.receivingTeamId),
  ]);

  const receivingReceiving = proposingRoster.filter((player) =>
    proposingOfferIds.includes(player.id),
  );

  const { needed, candidates, analysis } = listDropCandidates(
    receivingRoster,
    receivingOfferIds,
    receivingReceiving,
    season.settings.rosterSlots,
    season.benchSlots,
  );

  const selectableCandidateIds =
    analysis.selectionMode === "positions"
      ? candidates
          .filter((player) => isDropPlayerSelectable(analysis, player))
          .map((player) => player.id)
      : candidates.map((player) => player.id);

  const rosterRows = await listRosterPlayerRows(
    team.id,
    selectableCandidateIds,
  );

  return {
    ok: true,
    preview: {
      dropsNeeded: needed,
      candidates: rosterRows.map((row) => ({
        id: row.playerId,
        fullName: row.fullName,
        primaryPositionId: row.primaryPositionId,
        nflTeam: row.nflTeam,
      })),
    },
  };
}

export async function processReadyTrades(slug: string) {
  const context = await getTradeContext(slug);
  if ("error" in context) {
    return;
  }

  const expired = await getExpiredReviewTrades(context.season.id);
  const wire = resolveWaiverWireSettings(context.season.settings.waiverWire);
  const league = {
    leagueSeasonId: context.season.id,
    leaguePublicId: context.league.publicId,
    leagueName: context.league.name,
  };

  for (const row of expired) {
    await completeExpiredTrade({
      tradeId: row.id,
      league,
      waiversEnabled: context.season.waiversEnabled,
      waiverWire: wire,
    }).catch(() => undefined);
  }

  if (expired.length > 0) {
    revalidateTradePaths(slug);
  }
}

export async function proposeTrade(
  slug: string,
  input: {
    receivingTeamId: string;
    proposingOfferIds: string[];
    receivingOfferIds: string[];
    proposingDropIds: string[];
    receivingDropIds: string[];
    comment?: string;
    counterOfTradeId?: string;
  },
): Promise<TradeActionResult> {
  const context = await getTradeContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { user, league, season, team } = context;

  const proposeError = await assertCanPropose(season);
  if (proposeError) {
    return { success: false, error: proposeError };
  }

  if (input.receivingTeamId === team.id) {
    return { success: false, error: "Choose a different team to trade with." };
  }

  let counterOfTradeId: string | undefined;
  if (input.counterOfTradeId) {
    const original = await getTradeById(input.counterOfTradeId);
    if (
      !original ||
      original.leagueSeasonId !== season.id ||
      original.status !== "pending" ||
      original.receivingTeamId !== team.id
    ) {
      return {
        success: false,
        error: "Original trade is no longer available to counter.",
      };
    }
    if (original.proposingTeamId !== input.receivingTeamId) {
      return {
        success: false,
        error: "Counter must be sent to the original proposing team.",
      };
    }
    counterOfTradeId = original.id;
  }

  const [partner] = await db
    .select({ id: teams.id, name: teams.name, userId: teams.userId })
    .from(teams)
    .where(
      and(
        eq(teams.id, input.receivingTeamId),
        eq(teams.leagueSeasonId, season.id),
      ),
    )
    .limit(1);

  if (!partner) {
    return { success: false, error: "Trade partner not found." };
  }

  const irError = await assertNoIrLock(
    team.id,
    season.settings.irEligibleStatuses,
  );
  if (irError) {
    return { success: false, error: irError };
  }

  const allIds = [
    ...input.proposingOfferIds,
    ...input.receivingOfferIds,
    ...input.proposingDropIds,
    ...input.receivingDropIds,
  ];

  const lockError = await assertPlayersAvailable(allIds, team.id);
  if (lockError) {
    return { success: false, error: lockError };
  }

  const [proposingRoster, receivingRoster] = await Promise.all([
    toTradeRosterPlayers(team.id),
    toTradeRosterPlayers(partner.id),
  ]);

  const rules = resolveTransactionRules(season.settings.transactionRules);
  const validation = validateTradeProposal({
    proposingTeamId: team.id,
    proposingTeamLabel: team.name,
    receivingTeamId: partner.id,
    receivingTeamLabel: partner.name,
    proposingRoster,
    receivingRoster,
    proposingOfferIds: input.proposingOfferIds,
    receivingOfferIds: input.receivingOfferIds,
    proposingDropIds: input.proposingDropIds,
    receivingDropIds: input.receivingDropIds,
    rosterSlots: season.settings.rosterSlots,
    benchSlots: season.benchSlots,
    enforceRosterMinimums: rules.enforceRosterMinimums,
  });

  if (!validation.ok) {
    return { success: false, errors: validation.errors };
  }

  const result = await commitTradeProposal({
    league: {
      leagueSeasonId: season.id,
      leaguePublicId: league.publicId,
      leagueName: league.name,
    },
    actor: {
      userId: user.id,
      teamId: team.id,
      teamName: team.name,
    },
    receivingTeam: partner,
    proposingOfferIds: input.proposingOfferIds,
    receivingOfferIds: input.receivingOfferIds,
    proposingDropIds: input.proposingDropIds,
    receivingDropIds: input.receivingDropIds,
    comment: input.comment?.trim() || null,
    counterOfTradeId,
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  revalidateTradePaths(league.publicId);
  return { success: true };
}

async function getTradeForAction(
  slug: string,
  tradeId: string,
): Promise<
  | { error: string }
  | {
      context: Exclude<TradeContext, { error: string }>;
      trade: NonNullable<Awaited<ReturnType<typeof getTradeById>>>;
    }
> {
  const context = await getTradeContext(slug);
  if ("error" in context) {
    return { error: context.error };
  }

  const trade = await getTradeById(tradeId);
  if (!trade || trade.leagueSeasonId !== context.season.id) {
    return { error: "Trade not found." };
  }

  return { context, trade };
}

export async function acceptTrade(
  slug: string,
  tradeId: string,
  receivingDropIds: string[] = [],
): Promise<TradeActionResult> {
  const loaded = await getTradeForAction(slug, tradeId);
  if ("error" in loaded) {
    return { success: false, error: loaded.error };
  }

  const { context, trade } = loaded;
  const { season, team, user, league } = context;

  if (trade.status !== "pending") {
    return { success: false, error: "This trade is no longer pending." };
  }

  if (trade.receivingTeamId !== team.id) {
    return { success: false, error: "Only the receiving team can accept." };
  }

  const tradePlayerRows = await db
    .select({
      teamId: tradePlayers.teamId,
      playerId: tradePlayers.playerId,
      isDrop: tradePlayers.isDrop,
    })
    .from(tradePlayers)
    .where(eq(tradePlayers.tradeId, tradeId));

  const proposingOfferIds = tradePlayerRows
    .filter((row) => row.teamId === trade.proposingTeamId && !row.isDrop)
    .map((row) => row.playerId);
  const receivingOfferIds = tradePlayerRows
    .filter((row) => row.teamId === trade.receivingTeamId && !row.isDrop)
    .map((row) => row.playerId);
  const proposingDropIds = tradePlayerRows
    .filter((row) => row.teamId === trade.proposingTeamId && row.isDrop)
    .map((row) => row.playerId);

  const [proposingTeam] = await db
    .select({ name: teams.name, userId: teams.userId })
    .from(teams)
    .where(eq(teams.id, trade.proposingTeamId))
    .limit(1);

  const [proposingRoster, receivingRoster] = await Promise.all([
    toTradeRosterPlayers(trade.proposingTeamId),
    toTradeRosterPlayers(trade.receivingTeamId),
  ]);

  const rules = resolveTransactionRules(season.settings.transactionRules);
  const validation = validateTradeProposal({
    proposingTeamId: trade.proposingTeamId,
    proposingTeamLabel: proposingTeam?.name ?? "Proposing team",
    receivingTeamId: trade.receivingTeamId,
    receivingTeamLabel: team.name,
    proposingRoster,
    receivingRoster,
    proposingOfferIds,
    receivingOfferIds,
    proposingDropIds,
    receivingDropIds,
    rosterSlots: season.settings.rosterSlots,
    benchSlots: season.benchSlots,
    enforceRosterMinimums: rules.enforceRosterMinimums,
  });

  if (!validation.ok) {
    return { success: false, errors: validation.errors };
  }

  const irError = await assertNoIrLock(
    team.id,
    season.settings.irEligibleStatuses,
  );
  if (irError) {
    return { success: false, error: irError };
  }

  const nextStatus = resolveNextStatusOnAccept(season.tradeProcessing);
  const reviewEndsAt =
    nextStatus === "review" ? reviewEndsAtFromNow(24) : null;
  const wire = resolveWaiverWireSettings(season.settings.waiverWire);

  const result = await acceptTradeOffer({
    tradeId,
    proposingTeamId: trade.proposingTeamId,
    receivingTeamId: trade.receivingTeamId,
    receivingDropIds,
    nextStatus,
    reviewEndsAt,
    league: {
      leagueSeasonId: season.id,
      leaguePublicId: league.publicId,
      leagueName: league.name,
    },
    actor: {
      userId: user.id,
      teamId: team.id,
      teamName: team.name,
    },
    proposingTeam: {
      name: proposingTeam?.name ?? "Proposing team",
      userId: proposingTeam?.userId ?? null,
    },
    waiversEnabled: season.waiversEnabled,
    waiverWire: wire,
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  revalidateTradePaths(slug);
  return { success: true };
}

export async function rejectTrade(
  slug: string,
  tradeId: string,
): Promise<TradeActionResult> {
  const loaded = await getTradeForAction(slug, tradeId);
  if ("error" in loaded) {
    return { success: false, error: loaded.error };
  }

  const { context, trade } = loaded;

  if (trade.status !== "pending") {
    return { success: false, error: "This trade is no longer pending." };
  }

  if (trade.receivingTeamId !== context.team.id) {
    return { success: false, error: "Only the receiving team can reject." };
  }

  const result = await rejectTradeOffer({
    tradeId,
    proposingTeamId: trade.proposingTeamId,
    league: {
      leagueSeasonId: context.season.id,
      leaguePublicId: context.league.publicId,
      leagueName: context.league.name,
    },
    actor: {
      userId: context.user.id,
      teamId: context.team.id,
      teamName: context.team.name,
    },
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  revalidateTradePaths(slug);
  return { success: true };
}

export async function cancelTrade(
  slug: string,
  tradeId: string,
): Promise<TradeActionResult> {
  const loaded = await getTradeForAction(slug, tradeId);
  if ("error" in loaded) {
    return { success: false, error: loaded.error };
  }

  const { context, trade } = loaded;

  if (trade.status !== "pending") {
    return { success: false, error: "Only pending trades can be cancelled." };
  }

  if (trade.proposingTeamId !== context.team.id) {
    return { success: false, error: "Only the proposing team can cancel." };
  }

  const result = await cancelTradeOffer({
    tradeId,
    receivingTeamId: trade.receivingTeamId,
    league: {
      leagueSeasonId: context.season.id,
      leaguePublicId: context.league.publicId,
      leagueName: context.league.name,
    },
    actor: {
      userId: context.user.id,
      teamId: context.team.id,
      teamName: context.team.name,
    },
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  revalidateTradePaths(slug);
  return { success: true };
}

export async function approveTrade(
  slug: string,
  tradeId: string,
): Promise<TradeActionResult> {
  const loaded = await getTradeForAction(slug, tradeId);
  if ("error" in loaded) {
    return { success: false, error: loaded.error };
  }

  const { context, trade } = loaded;

  if (context.membership.role !== "commissioner") {
    return { success: false, error: "Commissioner only." };
  }

  if (trade.status !== "awaiting_commissioner") {
    return { success: false, error: "Trade is not awaiting commissioner approval." };
  }

  if (context.season.tradeProcessing !== "commissioner") {
    return { success: false, error: "Commissioner approval is not enabled." };
  }

  const wire = resolveWaiverWireSettings(context.season.settings.waiverWire);
  const result = await approveTradeByCommissioner({
    tradeId,
    proposingTeamId: trade.proposingTeamId,
    receivingTeamId: trade.receivingTeamId,
    league: {
      leagueSeasonId: context.season.id,
      leaguePublicId: context.league.publicId,
      leagueName: context.league.name,
    },
    actorUserId: context.user.id,
    waiversEnabled: context.season.waiversEnabled,
    waiverWire: wire,
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  revalidateTradePaths(slug);
  return { success: true };
}

export async function commissionerRejectTrade(
  slug: string,
  tradeId: string,
): Promise<TradeActionResult> {
  const loaded = await getTradeForAction(slug, tradeId);
  if ("error" in loaded) {
    return { success: false, error: loaded.error };
  }

  const { context, trade } = loaded;

  if (context.membership.role !== "commissioner") {
    return { success: false, error: "Commissioner only." };
  }

  if (trade.status !== "awaiting_commissioner") {
    return { success: false, error: "Trade is not awaiting commissioner approval." };
  }

  const result = await rejectTradeByCommissioner({
    tradeId,
    proposingTeamId: trade.proposingTeamId,
    receivingTeamId: trade.receivingTeamId,
    league: {
      leagueSeasonId: context.season.id,
      leaguePublicId: context.league.publicId,
      leagueName: context.league.name,
    },
    actorUserId: context.user.id,
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  revalidateTradePaths(slug);
  return { success: true };
}

export async function vetoTrade(
  slug: string,
  tradeId: string,
): Promise<TradeActionResult> {
  const loaded = await getTradeForAction(slug, tradeId);
  if ("error" in loaded) {
    return { success: false, error: loaded.error };
  }

  const { context, trade } = loaded;
  const rules = resolveTransactionRules(context.season.settings.transactionRules);

  if (!rules.allowVetoes) {
    return { success: false, error: "League vetoes are disabled." };
  }

  if (trade.status !== "review") {
    return { success: false, error: "Only trades under review can be vetoed." };
  }

  if (
    trade.proposingTeamId === context.team.id ||
    trade.receivingTeamId === context.team.id
  ) {
    return {
      success: false,
      error: "Teams involved in the trade cannot vote to veto.",
    };
  }

  if (await hasTeamVotedVeto(tradeId, context.team.id)) {
    return { success: false, error: "Your team already voted to veto." };
  }

  const teamCount = await countSeasonTeams(context.season.id);
  const result = await castTradeVeto({
    tradeId,
    proposingTeamId: trade.proposingTeamId,
    receivingTeamId: trade.receivingTeamId,
    league: {
      leagueSeasonId: context.season.id,
      leaguePublicId: context.league.publicId,
      leagueName: context.league.name,
    },
    actor: {
      userId: context.user.id,
      teamId: context.team.id,
      teamName: context.team.name,
    },
    teamCount,
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  revalidateTradePaths(slug);
  return { success: true };
}
