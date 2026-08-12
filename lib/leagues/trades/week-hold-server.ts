import "server-only";

import { eq, inArray } from "drizzle-orm";

import { players, tradePlayers, trades } from "@/db/schema";
import { db } from "@/lib/db";
import { loadStartedNflTeamsForLineupLock } from "@/lib/leagues/lineup-lock-started";
import {
  reviewEndsAtForWeekHold,
  tradeNeedsWeekEndHold,
} from "@/lib/leagues/trades/week-hold";

export async function loadTradeInvolvedNflTeams(
  tradeId: string,
): Promise<Array<string | null>> {
  const rows = await db
    .select({ nflTeam: players.nflTeam })
    .from(tradePlayers)
    .innerJoin(players, eq(tradePlayers.playerId, players.id))
    .where(eq(tradePlayers.tradeId, tradeId));
  return rows.map((row) => row.nflTeam);
}

export async function loadNflTeamsForPlayerIds(
  playerIds: string[],
): Promise<Array<string | null>> {
  if (playerIds.length === 0) return [];
  const unique = [...new Set(playerIds)];
  const rows = await db
    .select({ nflTeam: players.nflTeam })
    .from(players)
    .where(inArray(players.id, unique));
  return rows.map((row) => row.nflTeam);
}

/** If any involved player has started, push reviewEndsAt to fantasy week end. */
export async function deferTradeExecutionIfWeekHold(
  tradeId: string,
): Promise<{ deferred: boolean }> {
  const startedTeams = await loadStartedNflTeamsForLineupLock();
  if (!startedTeams) {
    return { deferred: false };
  }

  const nflTeams = await loadTradeInvolvedNflTeams(tradeId);
  if (!tradeNeedsWeekEndHold({ nflTeams, startedTeams })) {
    return { deferred: false };
  }

  const reviewEndsAt = reviewEndsAtForWeekHold();
  await db
    .update(trades)
    .set({
      status: "review",
      reviewEndsAt,
      updatedAt: new Date(),
    })
    .where(eq(trades.id, tradeId));

  return { deferred: true };
}
