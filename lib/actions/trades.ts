"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { leagues, leagueSeasons, teams, tradePlayers, tradeVetoes, trades, waiverClaims } from "@/db/schema";
import { requireSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  formatIrLockMessage,
  getIrLockViolations,
} from "@/lib/leagues/ir-lock";
import { resolveTransactionRules } from "@/lib/leagues/transaction-rules";
import {
  canProposeTrades,
  isTradeDeadlinePassed,
  tradeDeadlineError,
} from "@/lib/leagues/trades/guards";
import { executeTrade, logTradeActivity } from "@/lib/leagues/trades/execute";
import {
  resolveNextStatusOnAccept,
  reviewEndsAtFromNow,
} from "@/lib/leagues/trades/status";
import {
  isDropPlayerSelectable,
  listDropCandidates,
  validateTradeProposal,
} from "@/lib/leagues/trades/validate";
import {
  countEligibleVetoVoters,
  vetoThreshold,
} from "@/lib/leagues/trades/vetoes";
import { resolveWaiverWireSettings } from "@/lib/leagues/waiver-wire";
import {
  getLeagueBySlug,
  getLeagueMembership,
  getLeagueSeason,
} from "@/lib/queries/leagues";
import {
  getExpiredReviewTrades,
  getTradeById,
  listRosterPlayerRows,
  toTradeRosterPlayers,
} from "@/lib/queries/trades";
import { getTeamRosterPlayers } from "@/lib/queries/team-roster";
import { getUserTeamForSeason } from "@/lib/queries/watchlist";
import { getNflState } from "@/lib/sleeper/api";
import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import {
  getTeamOwnerUserIds,
  notifyUsers,
} from "@/lib/notifications/notify";
import {
  announceTradeAcceptedReview,
  announceTradeProposed,
  announceTradeVetoed,
} from "@/lib/alerts/trades";

export type TradeActionResult = {
  success: boolean;
  error?: string;
  errors?: string[];
};

type TradeContext =
  | { error: string }
  | {
      user: Awaited<ReturnType<typeof requireSessionUser>>;
      league: NonNullable<Awaited<ReturnType<typeof getLeagueBySlug>>>;
      season: NonNullable<Awaited<ReturnType<typeof getLeagueSeason>>>;
      team: NonNullable<Awaited<ReturnType<typeof getUserTeamForSeason>>>;
      membership: NonNullable<Awaited<ReturnType<typeof getLeagueMembership>>>;
    };

async function getTradeContext(slug: string): Promise<TradeContext> {
  const user = await requireSessionUser();
  const league = await getLeagueBySlug(slug);
  if (!league) {
    return { error: "League not found." };
  }

  const membership = await getLeagueMembership(league.id, user.id);
  if (!membership) {
    return { error: "You are not a member of this league." };
  }

  const season = await getLeagueSeason(league.id);
  if (!season) {
    return { error: "League season not found." };
  }

  const team = await getUserTeamForSeason(season.id, user.id);
  if (!team) {
    return { error: "Team not found." };
  }

  return { user, league, season, team, membership };
}

function revalidateTradePaths(slug: string) {
  revalidatePath(`/league/${slug}/trades`);
  revalidatePath(`/league/${slug}/trades/new`);
  revalidatePath(`/league/${slug}/team`);
  revalidatePath(`/league/${slug}/activity`);
}

async function assertCanPropose(
  season: NonNullable<Awaited<ReturnType<typeof getLeagueSeason>>>,
) {
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

async function completeExpiredTrade(
  tradeId: string,
  leagueSeasonId: string,
  leaguePublicId: string,
  waiversEnabled: boolean,
  waiverWire: ReturnType<typeof resolveWaiverWireSettings>,
) {
  const trade = await getTradeById(tradeId);
  if (!trade) {
    return { success: false as const, error: "Trade not found." };
  }

  const result = await executeTrade({
    tradeId,
    waiversEnabled,
    waiverWire,
  });
  if (!result.success) {
    return { success: false as const, error: result.error };
  }

  await logTradeActivity({
    leagueSeasonId,
    tradeId,
    type: "trade_completed",
    summary: "Trade completed after review period.",
  });

  const owners = await getTeamOwnerUserIds([
    trade.proposingTeamId,
    trade.receivingTeamId,
  ]);
  await notifyUsers({
    userIds: [
      owners.get(trade.proposingTeamId),
      owners.get(trade.receivingTeamId),
    ],
    leagueSeasonId,
    leaguePublicId,
    type: "trade_update",
    title: "Trade completed",
    body: "Your trade completed after the review period.",
    tradeId,
  });

  return { success: true as const };
}

export async function processReadyTrades(slug: string) {
  const context = await getTradeContext(slug);
  if ("error" in context) {
    return;
  }

  const expired = await getExpiredReviewTrades(context.season.id);
  const wire = resolveWaiverWireSettings(context.season.settings.waiverWire);

  for (const row of expired) {
    await completeExpiredTrade(
      row.id,
      context.season.id,
      context.league.publicId,
      context.season.waiversEnabled,
      wire,
    ).catch(() => undefined);
  }

  if (expired.length > 0) {
    revalidateTradePaths(slug);
  }
}

export async function processAllReadyTrades(_now: Date = new Date()) {
  const expired = await getExpiredReviewTrades();
  if (expired.length === 0) {
    return { checked: 0, processed: 0, results: [] as Array<{ tradeId: string; slug: string }> };
  }

  const seasonIds = [...new Set(expired.map((row) => row.leagueSeasonId))];
  const seasons = await db
    .select({
      id: leagueSeasons.id,
      waiversEnabled: leagueSeasons.waiversEnabled,
      settings: leagueSeasons.settings,
      slug: leagues.slug,
      publicId: leagues.publicId,
    })
    .from(leagueSeasons)
    .innerJoin(leagues, eq(leagueSeasons.leagueId, leagues.id))
    .where(inArray(leagueSeasons.id, seasonIds));

  const seasonById = new Map(seasons.map((season) => [season.id, season]));
  const results: Array<{ tradeId: string; slug: string }> = [];

  for (const row of expired) {
    const season = seasonById.get(row.leagueSeasonId);
    if (!season) {
      continue;
    }

    const wire = resolveWaiverWireSettings(
      (season.settings as LeagueSeasonSettings | null)?.waiverWire,
    );
    const result = await completeExpiredTrade(
      row.id,
      season.id,
      season.publicId,
      season.waiversEnabled,
      wire,
    );
    if (result.success) {
      results.push({ tradeId: row.id, slug: season.publicId });
      revalidateTradePaths(season.publicId);
    }
  }

  return {
    checked: expired.length,
    processed: results.length,
    results,
  };
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

  const [trade] = await db
    .insert(trades)
    .values({
      leagueSeasonId: season.id,
      proposingTeamId: team.id,
      receivingTeamId: partner.id,
      status: "pending",
      comment: input.comment?.trim() || null,
      createdByUserId: user.id,
    })
    .returning({ id: trades.id });

  const rows = [
    ...input.proposingOfferIds.map((playerId) => ({
      tradeId: trade.id,
      teamId: team.id,
      playerId,
      isDrop: false,
    })),
    ...input.receivingOfferIds.map((playerId) => ({
      tradeId: trade.id,
      teamId: partner.id,
      playerId,
      isDrop: false,
    })),
    ...input.proposingDropIds.map((playerId) => ({
      tradeId: trade.id,
      teamId: team.id,
      playerId,
      isDrop: true,
    })),
    ...input.receivingDropIds.map((playerId) => ({
      tradeId: trade.id,
      teamId: partner.id,
      playerId,
      isDrop: true,
    })),
  ];

  if (rows.length > 0) {
    await db.insert(tradePlayers).values(rows);
  }

  await logTradeActivity({
    leagueSeasonId: season.id,
    tradeId: trade.id,
    type: "trade_proposed",
    summary: counterOfTradeId
      ? `${team.name} sent a counter-offer to ${partner.name}.`
      : `${team.name} proposed a trade with ${partner.name}.`,
    teamId: team.id,
    actorUserId: user.id,
  });

  if (counterOfTradeId) {
    await db
      .update(trades)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(trades.id, counterOfTradeId));

    await logTradeActivity({
      leagueSeasonId: season.id,
      tradeId: counterOfTradeId,
      type: "trade_rejected",
      summary: `${team.name} countered the trade.`,
      teamId: team.id,
      actorUserId: user.id,
    });
  }

  await announceTradeProposed({
    tradeId: trade.id,
    leagueSeasonId: season.id,
    leaguePublicId: league.publicId,
    leagueName: league.name,
    recipientUserId: partner.userId,
    proposingTeamName: team.name,
    isCounter: Boolean(counterOfTradeId),
  });

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

  if (receivingDropIds.length > 0) {
    await db.insert(tradePlayers).values(
      receivingDropIds.map((playerId) => ({
        tradeId,
        teamId: team.id,
        playerId,
        isDrop: true,
      })),
    );
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

  await db
    .update(trades)
    .set({
      status: nextStatus,
      counterpartyAcceptedAt: new Date(),
      reviewEndsAt,
      updatedAt: new Date(),
    })
    .where(eq(trades.id, tradeId));

  const wire = resolveWaiverWireSettings(season.settings.waiverWire);

  if (nextStatus === "completed") {
    const result = await executeTrade({
      tradeId,
      waiversEnabled: season.waiversEnabled,
      waiverWire: wire,
    });
    if (!result.success) {
      return { success: false, error: result.error };
    }
    await logTradeActivity({
      leagueSeasonId: season.id,
      tradeId,
      type: "trade_completed",
      summary: "Trade completed.",
      actorUserId: user.id,
    });
  }

  const acceptBody =
    nextStatus === "completed"
      ? `${team.name} accepted your trade. It is now complete.`
      : nextStatus === "review"
        ? `${team.name} accepted your trade. It is under league review.`
        : `${team.name} accepted your trade. It awaits commissioner approval.`;

  if (nextStatus === "review") {
    await announceTradeAcceptedReview({
      tradeId,
      leagueSeasonId: season.id,
      leaguePublicId: league.publicId,
      leagueName: league.name,
      proposingTeamName: proposingTeam?.name ?? "Proposing team",
      receivingTeamName: team.name,
      proposingUserId: proposingTeam?.userId,
      receivingUserId: team.userId,
      reviewEndsAt,
      acceptBody,
    });
  } else {
    await notifyUsers({
      userIds: [proposingTeam?.userId],
      leagueSeasonId: season.id,
      leaguePublicId: league.publicId,
      type: "trade_update",
      title:
        nextStatus === "completed" ? "Trade completed" : "Trade offer accepted",
      body: acceptBody,
      tradeId,
    });
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

  await db
    .update(trades)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(trades.id, tradeId));

  await logTradeActivity({
    leagueSeasonId: context.season.id,
    tradeId,
    type: "trade_rejected",
    summary: `${context.team.name} rejected the trade.`,
    teamId: context.team.id,
    actorUserId: context.user.id,
  });

  const owners = await getTeamOwnerUserIds([trade.proposingTeamId]);
  await notifyUsers({
    userIds: [owners.get(trade.proposingTeamId)],
    leagueSeasonId: context.season.id,
    leaguePublicId: context.league.publicId,
    type: "trade_update",
    title: "Trade offer rejected",
    body: `${context.team.name} rejected your trade offer.`,
    tradeId,
  });

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

  await db
    .update(trades)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(trades.id, tradeId));

  await logTradeActivity({
    leagueSeasonId: context.season.id,
    tradeId,
    type: "trade_cancelled",
    summary: `${context.team.name} cancelled the trade.`,
    teamId: context.team.id,
    actorUserId: context.user.id,
  });

  const owners = await getTeamOwnerUserIds([trade.receivingTeamId]);
  await notifyUsers({
    userIds: [owners.get(trade.receivingTeamId)],
    leagueSeasonId: context.season.id,
    leaguePublicId: context.league.publicId,
    type: "trade_update",
    title: "Trade offer cancelled",
    body: `${context.team.name} cancelled their trade offer.`,
    tradeId,
  });

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
  const result = await executeTrade({
    tradeId,
    waiversEnabled: context.season.waiversEnabled,
    waiverWire: wire,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  await logTradeActivity({
    leagueSeasonId: context.season.id,
    tradeId,
    type: "trade_completed",
    summary: "Commissioner approved the trade.",
    actorUserId: context.user.id,
  });

  const owners = await getTeamOwnerUserIds([
    trade.proposingTeamId,
    trade.receivingTeamId,
  ]);
  await notifyUsers({
    userIds: [
      owners.get(trade.proposingTeamId),
      owners.get(trade.receivingTeamId),
    ],
    leagueSeasonId: context.season.id,
    leaguePublicId: context.league.publicId,
    type: "trade_update",
    title: "Trade completed",
    body: "The commissioner approved your trade.",
    tradeId,
  });

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

  await db
    .update(trades)
    .set({ status: "commissioner_rejected", updatedAt: new Date() })
    .where(eq(trades.id, tradeId));

  await logTradeActivity({
    leagueSeasonId: context.season.id,
    tradeId,
    type: "trade_rejected",
    summary: "Commissioner rejected the trade.",
    actorUserId: context.user.id,
  });

  const owners = await getTeamOwnerUserIds([
    trade.proposingTeamId,
    trade.receivingTeamId,
  ]);
  await notifyUsers({
    userIds: [
      owners.get(trade.proposingTeamId),
      owners.get(trade.receivingTeamId),
    ],
    leagueSeasonId: context.season.id,
    leaguePublicId: context.league.publicId,
    type: "trade_update",
    title: "Trade rejected",
    body: "The commissioner rejected your trade.",
    tradeId,
  });

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

  const existing = await db
    .select({ id: tradeVetoes.id })
    .from(tradeVetoes)
    .where(
      and(
        eq(tradeVetoes.tradeId, tradeId),
        eq(tradeVetoes.teamId, context.team.id),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return { success: false, error: "Your team already voted to veto." };
  }

  await db.insert(tradeVetoes).values({
    tradeId,
    teamId: context.team.id,
    userId: context.user.id,
  });

  const teamCountRows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.leagueSeasonId, context.season.id));

  const eligible = countEligibleVetoVoters(teamCountRows.length);
  const threshold = vetoThreshold(eligible);

  const vetoCountRows = await db
    .select({ id: tradeVetoes.id })
    .from(tradeVetoes)
    .where(eq(tradeVetoes.tradeId, tradeId));

  if (vetoCountRows.length >= threshold) {
    await db
      .update(trades)
      .set({ status: "vetoed", updatedAt: new Date() })
      .where(eq(trades.id, tradeId));

    await logTradeActivity({
      leagueSeasonId: context.season.id,
      tradeId,
      type: "trade_vetoed",
      summary: `Trade vetoed (${vetoCountRows.length} of ${threshold} required).`,
      teamId: context.team.id,
      actorUserId: context.user.id,
    });

    await announceTradeVetoed({
      tradeId,
      leagueSeasonId: context.season.id,
      leaguePublicId: context.league.publicId,
      leagueName: context.league.name,
      proposingTeamId: trade.proposingTeamId,
      receivingTeamId: trade.receivingTeamId,
    });
  }

  revalidateTradePaths(slug);
  return { success: true };
}
