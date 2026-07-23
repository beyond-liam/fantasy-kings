import { and, eq, inArray, isNull, ne } from "drizzle-orm";

import {
  leagueActivity,
  players,
  rosterPlayers,
  tradePlayers,
  trades,
} from "@/db/schema";
import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import { listRosteredPlayers } from "@/lib/leagues/roster-writes";
import { isOpenTradeStatus, OPEN_TRADE_STATUSES } from "@/lib/leagues/trades/guards";
import { validateTeamPostTrade } from "@/lib/leagues/trades/validate";
import { resolveWaiverWireSettings } from "@/lib/leagues/waiver-wire";

/** Thrown when another executor already claimed the trade; caught by executeTrade. */
class TradeClaimConflict extends Error {}

async function invalidateConflictingTrades(input: {
  completedTradeId: string;
  leagueSeasonId: string;
  playerIds: string[];
  // Drizzle transaction client shares the query API with `db`.
  tx: Pick<typeof db, "select" | "update" | "insert">;
}) {
  if (input.playerIds.length === 0) {
    return;
  }

  const conflicting = await input.tx
    .select({ tradeId: tradePlayers.tradeId })
    .from(tradePlayers)
    .innerJoin(trades, eq(tradePlayers.tradeId, trades.id))
    .where(
      and(
        eq(trades.leagueSeasonId, input.leagueSeasonId),
        inArray(trades.status, [...OPEN_TRADE_STATUSES]),
        inArray(tradePlayers.playerId, input.playerIds),
        ne(trades.id, input.completedTradeId),
      ),
    );

  const tradeIds = [...new Set(conflicting.map((row) => row.tradeId))];
  if (tradeIds.length === 0) {
    return;
  }

  await input.tx
    .update(trades)
    .set({ status: "invalidated", updatedAt: new Date() })
    .where(inArray(trades.id, tradeIds));

  await input.tx.insert(leagueActivity).values(
    tradeIds.map((tradeId) => ({
      leagueSeasonId: input.leagueSeasonId,
      type: "trade_cancelled" as const,
      tradeId,
      summary:
        "Trade invalidated — a player was included in another completed trade.",
      metadata: { tradeId, reason: "player_conflict" },
    })),
  );
}

/** Post-trade active roster/position caps for both teams — returns an error message, or null. */
async function checkPostTradeCapacity(input: {
  proposingTeamId: string;
  receivingTeamId: string;
  proposingOffers: { playerId: string }[];
  receivingOffers: { playerId: string }[];
  proposingDrops: { playerId: string }[];
  receivingDrops: { playerId: string }[];
  rosterByPlayer: Map<string, { primaryPositionId: string }>;
  rosterSlots: RosterSlotConfig[] | null | undefined;
  benchSlots: number;
}): Promise<string | null> {
  const incomingFor = (offers: { playerId: string }[]) =>
    offers.map((offer) => ({
      id: offer.playerId,
      slotPositionId: null,
      primaryPositionId: input.rosterByPlayer.get(offer.playerId)!
        .primaryPositionId,
    }));

  const [proposingRoster, receivingRoster] = await Promise.all([
    listRosteredPlayers(input.proposingTeamId),
    listRosteredPlayers(input.receivingTeamId),
  ]);

  const proposingResult = validateTeamPostTrade({
    teamId: input.proposingTeamId,
    teamLabel: "Proposing team",
    roster: proposingRoster,
    offeringIds: input.proposingOffers.map((offer) => offer.playerId),
    receiving: incomingFor(input.receivingOffers),
    dropIds: input.proposingDrops.map((drop) => drop.playerId),
    rosterSlots: input.rosterSlots,
    benchSlots: input.benchSlots,
    enforceRosterMinimums: false,
  });
  if (!proposingResult.ok) {
    return proposingResult.error;
  }

  const receivingResult = validateTeamPostTrade({
    teamId: input.receivingTeamId,
    teamLabel: "Receiving team",
    roster: receivingRoster,
    offeringIds: input.receivingOffers.map((offer) => offer.playerId),
    receiving: incomingFor(input.proposingOffers),
    dropIds: input.receivingDrops.map((drop) => drop.playerId),
    rosterSlots: input.rosterSlots,
    benchSlots: input.benchSlots,
    enforceRosterMinimums: false,
  });
  if (!receivingResult.ok) {
    return receivingResult.error;
  }

  return null;
}

export async function executeTrade(input: {
  tradeId: string;
  waiversEnabled: boolean;
  waiverWire: ReturnType<typeof resolveWaiverWireSettings>;
  rosterSlots: RosterSlotConfig[] | null | undefined;
  benchSlots: number;
}) {
  const tradeRows = await db
    .select({
      teamId: tradePlayers.teamId,
      playerId: tradePlayers.playerId,
      isDrop: tradePlayers.isDrop,
    })
    .from(tradePlayers)
    .where(eq(tradePlayers.tradeId, input.tradeId));

  const [trade] = await db
    .select()
    .from(trades)
    .where(eq(trades.id, input.tradeId))
    .limit(1);

  if (!trade) {
    return { success: false as const, error: "Trade not found." };
  }

  if (trade.completedAt) {
    return { success: true as const };
  }

  if (!isOpenTradeStatus(trade.status)) {
    return { success: false as const, error: "Trade is no longer open." };
  }

  const proposingTeamId = trade.proposingTeamId;
  const receivingTeamId = trade.receivingTeamId;

  const proposingOffers = tradeRows.filter(
    (row) => row.teamId === proposingTeamId && !row.isDrop,
  );
  const receivingOffers = tradeRows.filter(
    (row) => row.teamId === receivingTeamId && !row.isDrop,
  );
  const proposingDrops = tradeRows.filter(
    (row) => row.teamId === proposingTeamId && row.isDrop,
  );
  const receivingDrops = tradeRows.filter(
    (row) => row.teamId === receivingTeamId && row.isDrop,
  );

  const allPlayerIds = tradeRows.map((row) => row.playerId);
  const rosterRows = await db
    .select({
      id: rosterPlayers.id,
      teamId: rosterPlayers.teamId,
      playerId: rosterPlayers.playerId,
      slotPositionId: rosterPlayers.slotPositionId,
      primaryPositionId: players.primaryPositionId,
    })
    .from(rosterPlayers)
    .innerJoin(players, eq(rosterPlayers.playerId, players.id))
    .where(
      and(
        inArray(rosterPlayers.playerId, allPlayerIds),
        eq(rosterPlayers.status, "rostered"),
      ),
    );

  const rosterByPlayer = new Map(
    rosterRows.map((row) => [row.playerId, row]),
  );

  const playersStillAvailable =
    proposingOffers.every((offer) => {
      const row = rosterByPlayer.get(offer.playerId);
      return row != null && row.teamId === proposingTeamId;
    }) &&
    receivingOffers.every((offer) => {
      const row = rosterByPlayer.get(offer.playerId);
      return row != null && row.teamId === receivingTeamId;
    }) &&
    [...proposingDrops, ...receivingDrops].every((drop) => {
      const row = rosterByPlayer.get(drop.playerId);
      return row != null && row.teamId === drop.teamId;
    });

  const invalidate = async (summary: string) => {
    const [invalidated] = await db
      .update(trades)
      .set({ status: "invalidated", updatedAt: new Date() })
      .where(
        and(
          eq(trades.id, input.tradeId),
          inArray(trades.status, [...OPEN_TRADE_STATUSES]),
        ),
      )
      .returning({ id: trades.id });
    if (invalidated) {
      await logTradeActivity({
        leagueSeasonId: trade.leagueSeasonId,
        tradeId: input.tradeId,
        type: "trade_cancelled",
        summary,
      });
    }
  };

  if (!playersStillAvailable) {
    await invalidate(
      "Trade invalidated — a player was included in another completed trade.",
    );
    return {
      success: false as const,
      error: "Trade invalidated — a player is no longer available.",
      invalidated: true as const,
    };
  }

  const capacityError = await checkPostTradeCapacity({
    proposingTeamId,
    receivingTeamId,
    proposingOffers,
    receivingOffers,
    proposingDrops,
    receivingDrops,
    rosterByPlayer,
    rosterSlots: input.rosterSlots,
    benchSlots: input.benchSlots,
  });
  if (capacityError) {
    await invalidate("Trade invalidated — a roster would exceed its size limits.");
    return {
      success: false as const,
      error: capacityError,
      invalidated: true as const,
    };
  }

  const acquiredAt = new Date();

  try {
    await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(trades)
        .set({
          status: "completed",
          completedAt: acquiredAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(trades.id, input.tradeId),
            inArray(trades.status, [...OPEN_TRADE_STATUSES]),
            isNull(trades.completedAt),
          ),
        )
        .returning({ id: trades.id });
      if (!claimed) {
        throw new TradeClaimConflict();
      }

      for (const drop of [...proposingDrops, ...receivingDrops]) {
        const row = rosterByPlayer.get(drop.playerId)!;
        if (!input.waiversEnabled) {
          await tx.delete(rosterPlayers).where(eq(rosterPlayers.id, row.id));
        } else {
          const waiverClearsAt = new Date(
            Date.now() + input.waiverWire.dropWaiverHours * 60 * 60 * 1000,
          );
          await tx
            .update(rosterPlayers)
            .set({
              status: "waived",
              waiverClearsAt,
              slotPositionId: null,
              updatedAt: new Date(),
            })
            .where(eq(rosterPlayers.id, row.id));
        }
      }

      for (const offer of proposingOffers) {
        const row = rosterByPlayer.get(offer.playerId)!;
        await tx
          .update(rosterPlayers)
          .set({
            teamId: receivingTeamId,
            slotPositionId: null,
            acquiredAt,
            updatedAt: new Date(),
          })
          .where(eq(rosterPlayers.id, row.id));
      }

      for (const offer of receivingOffers) {
        const row = rosterByPlayer.get(offer.playerId)!;
        await tx
          .update(rosterPlayers)
          .set({
            teamId: proposingTeamId,
            slotPositionId: null,
            acquiredAt,
            updatedAt: new Date(),
          })
          .where(eq(rosterPlayers.id, row.id));
      }

      await invalidateConflictingTrades({
        completedTradeId: input.tradeId,
        leagueSeasonId: trade.leagueSeasonId,
        playerIds: allPlayerIds,
        tx,
      });
    });
  } catch (error) {
    if (error instanceof TradeClaimConflict) {
      const [current] = await db
        .select({ completedAt: trades.completedAt })
        .from(trades)
        .where(eq(trades.id, input.tradeId))
        .limit(1);
      if (current?.completedAt) {
        return { success: true as const };
      }
      return {
        success: false as const,
        error: "Trade was already resolved.",
        conflict: true as const,
      };
    }
    throw error;
  }

  return { success: true as const };
}

export async function logTradeActivity(input: {
  leagueSeasonId: string;
  tradeId: string;
  type:
    | "trade_proposed"
    | "trade_completed"
    | "trade_rejected"
    | "trade_cancelled"
    | "trade_vetoed";
  summary: string;
  teamId?: string;
  actorUserId?: string;
}) {
  await db.insert(leagueActivity).values({
    leagueSeasonId: input.leagueSeasonId,
    type: input.type,
    tradeId: input.tradeId,
    teamId: input.teamId ?? null,
    actorUserId: input.actorUserId ?? null,
    summary: input.summary,
    metadata: { tradeId: input.tradeId },
  });
}
