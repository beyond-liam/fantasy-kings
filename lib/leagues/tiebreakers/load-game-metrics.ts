import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import {
  playerScores,
  players,
  rosterPlayers,
} from "@/db/schema";
import { db } from "@/lib/db";
import { isActiveLineupSlot } from "@/lib/leagues/roster-slots";
import { calculatePlayerPoints } from "@/lib/leagues/scoring/calculate";
import { resolveScoringRuleDefinitions } from "@/lib/leagues/scoring/rules";
import type { ScoringPreset } from "@/lib/leagues/scoring/types";
import {
  accumulatePlayerIntoMetrics,
  emptyTeamGameTieMetrics,
  type TeamGameTieMetrics,
} from "@/lib/leagues/tiebreakers/game-compare";

/**
 * Build per-team game-tiebreaker metrics for a season week from current
 * roster slots + player_scores stats.
 */
export async function loadTeamWeekGameTieMetrics(input: {
  teamIds: string[];
  seasonYear: number;
  week: number;
  scoringPreset: string;
  scoringRules?: unknown;
}): Promise<Map<string, TeamGameTieMetrics>> {
  const result = new Map<string, TeamGameTieMetrics>();
  for (const teamId of input.teamIds) {
    result.set(teamId, emptyTeamGameTieMetrics());
  }
  if (input.teamIds.length === 0) return result;

  const rosterRows = await db
    .select({
      teamId: rosterPlayers.teamId,
      playerId: rosterPlayers.playerId,
      slotPositionId: rosterPlayers.slotPositionId,
      primaryPositionId: players.primaryPositionId,
    })
    .from(rosterPlayers)
    .innerJoin(players, eq(rosterPlayers.playerId, players.id))
    .where(
      and(
        inArray(rosterPlayers.teamId, input.teamIds),
        eq(rosterPlayers.status, "rostered"),
      ),
    );

  const playerIds = [...new Set(rosterRows.map((row) => row.playerId))];
  if (playerIds.length === 0) return result;

  const scoreRows = await db
    .select({
      playerId: playerScores.playerId,
      stats: playerScores.stats,
      ptsPpr: playerScores.ptsPpr,
      ptsStd: playerScores.ptsStd,
    })
    .from(playerScores)
    .where(
      and(
        inArray(playerScores.playerId, playerIds),
        eq(playerScores.season, String(input.seasonYear)),
        eq(playerScores.week, input.week),
        eq(playerScores.kind, "stats"),
      ),
    );

  const scoringRules = resolveScoringRuleDefinitions(
    input.scoringPreset as ScoringPreset,
    input.scoringRules as never,
  );

  const scoreByPlayer = new Map(
    scoreRows.map((row) => {
      const stats = (row.stats ?? {}) as Record<string, number | null>;
      return [
        row.playerId,
        {
          stats: stats as Record<string, unknown>,
          fantasyPtsByPosition: (position: string) => {
            const calculated = calculatePlayerPoints(
              stats,
              position,
              scoringRules,
            );
            if (calculated !== 0 || Object.keys(stats).length > 0) {
              return calculated;
            }
            return row.ptsPpr ?? row.ptsStd ?? 0;
          },
        },
      ] as const;
    }),
  );

  for (const row of rosterRows) {
    const metrics = result.get(row.teamId);
    if (!metrics) continue;
    const slot = row.slotPositionId ?? row.primaryPositionId;
    const isStarter = isActiveLineupSlot(slot);
    const scored = scoreByPlayer.get(row.playerId);
    accumulatePlayerIntoMetrics(metrics, {
      isStarter,
      fantasyPts: scored
        ? scored.fantasyPtsByPosition(row.primaryPositionId)
        : 0,
      stats: scored?.stats ?? null,
    });
  }

  return result;
}
