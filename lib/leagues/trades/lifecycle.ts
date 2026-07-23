import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { teams, tradePlayers, trades, tradeVetoes } from "@/db/schema";
import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import {
  announceTradeAcceptedReview,
  announceTradeProposed,
  announceTradeVetoed,
} from "@/lib/alerts/trades";
import { db } from "@/lib/db";
import { executeTrade, logTradeActivity } from "@/lib/leagues/trades/execute";
import {
  countEligibleVetoVoters,
  vetoThreshold,
} from "@/lib/leagues/trades/vetoes";
import type { resolveWaiverWireSettings } from "@/lib/leagues/waiver-wire";
import {
  getTeamOwnerUserIds,
  notifyUsers,
} from "@/lib/notifications/notify";

export type TradeLifecycleResult =
  | { ok: true; tradeId: string }
  | { ok: false; error: string };

export type TradeLeagueRef = {
  leagueSeasonId: string;
  leaguePublicId: string;
  leagueName: string;
};

export type TradeActor = {
  userId: string;
  teamId: string;
  teamName: string;
};

type WaiverWire = ReturnType<typeof resolveWaiverWireSettings>;

/** After review window — execute + notify both sides. */
export async function completeExpiredTrade(input: {
  tradeId: string;
  league: TradeLeagueRef;
  waiversEnabled: boolean;
  waiverWire: WaiverWire;
  rosterSlots: RosterSlotConfig[] | null | undefined;
  benchSlots: number;
}): Promise<TradeLifecycleResult> {
  const trade = await db
    .select({
      proposingTeamId: trades.proposingTeamId,
      receivingTeamId: trades.receivingTeamId,
    })
    .from(trades)
    .where(eq(trades.id, input.tradeId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!trade) {
    return { ok: false, error: "Trade not found." };
  }

  const result = await executeTrade({
    tradeId: input.tradeId,
    waiversEnabled: input.waiversEnabled,
    waiverWire: input.waiverWire,
    rosterSlots: input.rosterSlots,
    benchSlots: input.benchSlots,
  });
  if (!result.success) {
    return { ok: false, error: result.error };
  }

  await logTradeActivity({
    leagueSeasonId: input.league.leagueSeasonId,
    tradeId: input.tradeId,
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
    leagueSeasonId: input.league.leagueSeasonId,
    leaguePublicId: input.league.leaguePublicId,
    type: "trade_update",
    title: "Trade completed",
    body: "Your trade completed after the review period.",
    tradeId: input.tradeId,
  });

  return { ok: true, tradeId: input.tradeId };
}

/** Persist a validated proposal (optional counter of another pending trade). */
export async function commitTradeProposal(input: {
  league: TradeLeagueRef;
  actor: TradeActor;
  receivingTeam: { id: string; name: string; userId: string | null };
  proposingOfferIds: string[];
  receivingOfferIds: string[];
  proposingDropIds: string[];
  receivingDropIds: string[];
  comment: string | null;
  counterOfTradeId?: string;
}): Promise<TradeLifecycleResult> {
  const [trade] = await db
    .insert(trades)
    .values({
      leagueSeasonId: input.league.leagueSeasonId,
      proposingTeamId: input.actor.teamId,
      receivingTeamId: input.receivingTeam.id,
      status: "pending",
      comment: input.comment,
      createdByUserId: input.actor.userId,
    })
    .returning({ id: trades.id });

  const rows = [
    ...input.proposingOfferIds.map((playerId) => ({
      tradeId: trade.id,
      teamId: input.actor.teamId,
      playerId,
      isDrop: false,
    })),
    ...input.receivingOfferIds.map((playerId) => ({
      tradeId: trade.id,
      teamId: input.receivingTeam.id,
      playerId,
      isDrop: false,
    })),
    ...input.proposingDropIds.map((playerId) => ({
      tradeId: trade.id,
      teamId: input.actor.teamId,
      playerId,
      isDrop: true,
    })),
    ...input.receivingDropIds.map((playerId) => ({
      tradeId: trade.id,
      teamId: input.receivingTeam.id,
      playerId,
      isDrop: true,
    })),
  ];

  if (rows.length > 0) {
    await db.insert(tradePlayers).values(rows);
  }

  await logTradeActivity({
    leagueSeasonId: input.league.leagueSeasonId,
    tradeId: trade.id,
    type: "trade_proposed",
    summary: input.counterOfTradeId
      ? `${input.actor.teamName} sent a counter-offer to ${input.receivingTeam.name}.`
      : `${input.actor.teamName} proposed a trade with ${input.receivingTeam.name}.`,
    teamId: input.actor.teamId,
    actorUserId: input.actor.userId,
  });

  if (input.counterOfTradeId) {
    const [countered] = await db
      .update(trades)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(
        and(
          eq(trades.id, input.counterOfTradeId),
          eq(trades.status, "pending"),
        ),
      )
      .returning({ id: trades.id });

    if (countered) {
      await logTradeActivity({
        leagueSeasonId: input.league.leagueSeasonId,
        tradeId: input.counterOfTradeId,
        type: "trade_rejected",
        summary: `${input.actor.teamName} countered the trade.`,
        teamId: input.actor.teamId,
        actorUserId: input.actor.userId,
      });
    }
  }

  await announceTradeProposed({
    tradeId: trade.id,
    leagueSeasonId: input.league.leagueSeasonId,
    leaguePublicId: input.league.leaguePublicId,
    leagueName: input.league.leagueName,
    recipientUserId: input.receivingTeam.userId,
    proposingTeamName: input.actor.teamName,
    isCounter: Boolean(input.counterOfTradeId),
  });

  return { ok: true, tradeId: trade.id };
}

/** Apply accept after validation — status, optional execute, alerts. */
export async function acceptTradeOffer(input: {
  tradeId: string;
  proposingTeamId: string;
  receivingTeamId: string;
  receivingDropIds: string[];
  nextStatus: "review" | "awaiting_commissioner" | "completed";
  reviewEndsAt: Date | null;
  league: TradeLeagueRef;
  actor: TradeActor;
  proposingTeam: { name: string; userId: string | null };
  waiversEnabled: boolean;
  waiverWire: WaiverWire;
  rosterSlots: RosterSlotConfig[] | null | undefined;
  benchSlots: number;
}): Promise<TradeLifecycleResult> {
  if (input.receivingDropIds.length > 0) {
    await db.insert(tradePlayers).values(
      input.receivingDropIds.map((playerId) => ({
        tradeId: input.tradeId,
        teamId: input.actor.teamId,
        playerId,
        isDrop: true,
      })),
    );
  }

  const cleanupReceivingDrops = async () => {
    if (input.receivingDropIds.length > 0) {
      await db
        .delete(tradePlayers)
        .where(
          and(
            eq(tradePlayers.tradeId, input.tradeId),
            eq(tradePlayers.teamId, input.actor.teamId),
            eq(tradePlayers.isDrop, true),
            inArray(tradePlayers.playerId, input.receivingDropIds),
          ),
        );
    }
  };

  if (input.nextStatus === "completed") {
    // Do not pre-write "completed" — executeTrade claims the trade atomically
    // and is the only place that transitions it to completed.
    const [claimed] = await db
      .update(trades)
      .set({ counterpartyAcceptedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(trades.id, input.tradeId), eq(trades.status, "pending")))
      .returning({ id: trades.id });
    if (!claimed) {
      await cleanupReceivingDrops();
      return { ok: false, error: "This trade is no longer pending." };
    }

    const result = await executeTrade({
      tradeId: input.tradeId,
      waiversEnabled: input.waiversEnabled,
      waiverWire: input.waiverWire,
      rosterSlots: input.rosterSlots,
      benchSlots: input.benchSlots,
    });
    if (!result.success) {
      await cleanupReceivingDrops();
      return { ok: false, error: result.error };
    }
    await logTradeActivity({
      leagueSeasonId: input.league.leagueSeasonId,
      tradeId: input.tradeId,
      type: "trade_completed",
      summary: "Trade completed.",
      actorUserId: input.actor.userId,
    });
  } else {
    const [claimed] = await db
      .update(trades)
      .set({
        status: input.nextStatus,
        counterpartyAcceptedAt: new Date(),
        reviewEndsAt: input.reviewEndsAt,
        updatedAt: new Date(),
      })
      .where(and(eq(trades.id, input.tradeId), eq(trades.status, "pending")))
      .returning({ id: trades.id });
    if (!claimed) {
      await cleanupReceivingDrops();
      return { ok: false, error: "This trade is no longer pending." };
    }
  }

  const acceptBody =
    input.nextStatus === "completed"
      ? `${input.actor.teamName} accepted your trade. It is now complete.`
      : input.nextStatus === "review"
        ? `${input.actor.teamName} accepted your trade. It is under league review.`
        : `${input.actor.teamName} accepted your trade. It awaits commissioner approval.`;

  if (input.nextStatus === "review") {
    await announceTradeAcceptedReview({
      tradeId: input.tradeId,
      leagueSeasonId: input.league.leagueSeasonId,
      leaguePublicId: input.league.leaguePublicId,
      leagueName: input.league.leagueName,
      proposingTeamName: input.proposingTeam.name,
      receivingTeamName: input.actor.teamName,
      proposingUserId: input.proposingTeam.userId,
      receivingUserId: input.actor.userId,
      reviewEndsAt: input.reviewEndsAt,
      acceptBody,
    });
  } else {
    await notifyUsers({
      userIds: [input.proposingTeam.userId],
      leagueSeasonId: input.league.leagueSeasonId,
      leaguePublicId: input.league.leaguePublicId,
      type: "trade_update",
      title:
        input.nextStatus === "completed"
          ? "Trade completed"
          : "Trade offer accepted",
      body: acceptBody,
      tradeId: input.tradeId,
    });
  }

  return { ok: true, tradeId: input.tradeId };
}

export async function rejectTradeOffer(input: {
  tradeId: string;
  proposingTeamId: string;
  league: TradeLeagueRef;
  actor: TradeActor;
}): Promise<TradeLifecycleResult> {
  const [rejected] = await db
    .update(trades)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(and(eq(trades.id, input.tradeId), eq(trades.status, "pending")))
    .returning({ id: trades.id });
  if (!rejected) {
    return { ok: false, error: "This trade is no longer pending." };
  }

  await logTradeActivity({
    leagueSeasonId: input.league.leagueSeasonId,
    tradeId: input.tradeId,
    type: "trade_rejected",
    summary: `${input.actor.teamName} rejected the trade.`,
    teamId: input.actor.teamId,
    actorUserId: input.actor.userId,
  });

  const owners = await getTeamOwnerUserIds([input.proposingTeamId]);
  await notifyUsers({
    userIds: [owners.get(input.proposingTeamId)],
    leagueSeasonId: input.league.leagueSeasonId,
    leaguePublicId: input.league.leaguePublicId,
    type: "trade_update",
    title: "Trade offer rejected",
    body: `${input.actor.teamName} rejected your trade offer.`,
    tradeId: input.tradeId,
  });

  return { ok: true, tradeId: input.tradeId };
}

export async function cancelTradeOffer(input: {
  tradeId: string;
  receivingTeamId: string;
  league: TradeLeagueRef;
  actor: TradeActor;
}): Promise<TradeLifecycleResult> {
  const [cancelled] = await db
    .update(trades)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(trades.id, input.tradeId), eq(trades.status, "pending")))
    .returning({ id: trades.id });
  if (!cancelled) {
    return { ok: false, error: "This trade is no longer pending." };
  }

  await logTradeActivity({
    leagueSeasonId: input.league.leagueSeasonId,
    tradeId: input.tradeId,
    type: "trade_cancelled",
    summary: `${input.actor.teamName} cancelled the trade.`,
    teamId: input.actor.teamId,
    actorUserId: input.actor.userId,
  });

  const owners = await getTeamOwnerUserIds([input.receivingTeamId]);
  await notifyUsers({
    userIds: [owners.get(input.receivingTeamId)],
    leagueSeasonId: input.league.leagueSeasonId,
    leaguePublicId: input.league.leaguePublicId,
    type: "trade_update",
    title: "Trade offer cancelled",
    body: `${input.actor.teamName} cancelled their trade offer.`,
    tradeId: input.tradeId,
  });

  return { ok: true, tradeId: input.tradeId };
}

export async function approveTradeByCommissioner(input: {
  tradeId: string;
  proposingTeamId: string;
  receivingTeamId: string;
  league: TradeLeagueRef;
  actorUserId: string;
  waiversEnabled: boolean;
  waiverWire: WaiverWire;
  rosterSlots: RosterSlotConfig[] | null | undefined;
  benchSlots: number;
}): Promise<TradeLifecycleResult> {
  const result = await executeTrade({
    tradeId: input.tradeId,
    waiversEnabled: input.waiversEnabled,
    waiverWire: input.waiverWire,
    rosterSlots: input.rosterSlots,
    benchSlots: input.benchSlots,
  });
  if (!result.success) {
    return { ok: false, error: result.error };
  }

  await logTradeActivity({
    leagueSeasonId: input.league.leagueSeasonId,
    tradeId: input.tradeId,
    type: "trade_completed",
    summary: "Commissioner approved the trade.",
    actorUserId: input.actorUserId,
  });

  const owners = await getTeamOwnerUserIds([
    input.proposingTeamId,
    input.receivingTeamId,
  ]);
  await notifyUsers({
    userIds: [
      owners.get(input.proposingTeamId),
      owners.get(input.receivingTeamId),
    ],
    leagueSeasonId: input.league.leagueSeasonId,
    leaguePublicId: input.league.leaguePublicId,
    type: "trade_update",
    title: "Trade completed",
    body: "The commissioner approved your trade.",
    tradeId: input.tradeId,
  });

  return { ok: true, tradeId: input.tradeId };
}

export async function rejectTradeByCommissioner(input: {
  tradeId: string;
  proposingTeamId: string;
  receivingTeamId: string;
  league: TradeLeagueRef;
  actorUserId: string;
}): Promise<TradeLifecycleResult> {
  const [rejected] = await db
    .update(trades)
    .set({ status: "commissioner_rejected", updatedAt: new Date() })
    .where(
      and(
        eq(trades.id, input.tradeId),
        eq(trades.status, "awaiting_commissioner"),
      ),
    )
    .returning({ id: trades.id });
  if (!rejected) {
    return {
      ok: false,
      error: "Trade is not awaiting commissioner approval.",
    };
  }

  await logTradeActivity({
    leagueSeasonId: input.league.leagueSeasonId,
    tradeId: input.tradeId,
    type: "trade_rejected",
    summary: "Commissioner rejected the trade.",
    actorUserId: input.actorUserId,
  });

  const owners = await getTeamOwnerUserIds([
    input.proposingTeamId,
    input.receivingTeamId,
  ]);
  await notifyUsers({
    userIds: [
      owners.get(input.proposingTeamId),
      owners.get(input.receivingTeamId),
    ],
    leagueSeasonId: input.league.leagueSeasonId,
    leaguePublicId: input.league.leaguePublicId,
    type: "trade_update",
    title: "Trade rejected",
    body: "The commissioner rejected your trade.",
    tradeId: input.tradeId,
  });

  return { ok: true, tradeId: input.tradeId };
}

/** Record a veto vote; if threshold met, mark vetoed + announce. */
export async function castTradeVeto(input: {
  tradeId: string;
  proposingTeamId: string;
  receivingTeamId: string;
  league: TradeLeagueRef;
  actor: TradeActor;
  teamCount: number;
}): Promise<TradeLifecycleResult> {
  await db.insert(tradeVetoes).values({
    tradeId: input.tradeId,
    teamId: input.actor.teamId,
    userId: input.actor.userId,
  });

  const eligible = countEligibleVetoVoters(input.teamCount);
  const threshold = vetoThreshold(eligible);

  const vetoCountRows = await db
    .select({ id: tradeVetoes.id })
    .from(tradeVetoes)
    .where(eq(tradeVetoes.tradeId, input.tradeId));

  if (vetoCountRows.length >= threshold) {
    const [vetoed] = await db
      .update(trades)
      .set({ status: "vetoed", updatedAt: new Date() })
      .where(and(eq(trades.id, input.tradeId), eq(trades.status, "review")))
      .returning({ id: trades.id });

    if (vetoed) {
      await logTradeActivity({
        leagueSeasonId: input.league.leagueSeasonId,
        tradeId: input.tradeId,
        type: "trade_vetoed",
        summary: `Trade vetoed (${vetoCountRows.length} of ${threshold} required).`,
        teamId: input.actor.teamId,
        actorUserId: input.actor.userId,
      });

      await announceTradeVetoed({
        tradeId: input.tradeId,
        leagueSeasonId: input.league.leagueSeasonId,
        leaguePublicId: input.league.leaguePublicId,
        leagueName: input.league.leagueName,
        proposingTeamId: input.proposingTeamId,
        receivingTeamId: input.receivingTeamId,
      });
    }
  }

  return { ok: true, tradeId: input.tradeId };
}

export async function countSeasonTeams(leagueSeasonId: string) {
  const rows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.leagueSeasonId, leagueSeasonId));
  return rows.length;
}

export async function hasTeamVotedVeto(tradeId: string, teamId: string) {
  const existing = await db
    .select({ id: tradeVetoes.id })
    .from(tradeVetoes)
    .where(
      and(eq(tradeVetoes.tradeId, tradeId), eq(tradeVetoes.teamId, teamId)),
    )
    .limit(1);
  return existing.length > 0;
}
