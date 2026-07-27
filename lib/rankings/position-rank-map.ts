import { cache } from "react";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { playerExternalIds, playerScores, players } from "@/db/schema";
import { db } from "@/lib/db";
import { normalizePlayerStats } from "@/lib/leagues/scoring/normalize-stats";
import { calculatePlayerPoints } from "@/lib/leagues/scoring/calculate";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import { buildFantasyPositionRankById } from "@/lib/rankings/attach-position-ranks";

type RankMapKey = {
  season: string;
  week: number;
  kind: "projection" | "stats";
  scoringRules: ScoringRuleDefinition[];
};

type RankedPlayerForMap = {
  id: string;
  fullName: string;
  primaryPositionId: string;
  stats: Record<string, number | null>;
  fantasyPts: number | null;
};

/**
 * Load all players for a week, score them, and return fantasy position rank by player ID.
 * Wrapped in React.cache for per-request deduplication across multiple getRankedPlayers calls.
 */
export const getFantasyPositionRankMap = cache(
  async ({
    season,
    week,
    kind,
    scoringRules,
  }: RankMapKey): Promise<Map<string, number>> => {
    const rows = await db
      .select({
        id: players.id,
        fullName: players.fullName,
        primaryPositionId: players.primaryPositionId,
        stats: playerScores.stats,
        ptsPpr: playerScores.ptsPpr,
        ptsStd: playerScores.ptsStd,
      })
      .from(players)
      .innerJoin(
        playerScores,
        and(
          eq(playerScores.playerId, players.id),
          eq(playerScores.season, season),
          eq(playerScores.week, week),
          eq(playerScores.kind, kind),
          eq(playerScores.seasonType, "regular"),
        ),
      )
      .leftJoin(
        playerExternalIds,
        and(
          eq(playerExternalIds.playerId, players.id),
          eq(playerExternalIds.provider, "sleeper"),
        ),
      )
      .orderBy(
        desc(sql`coalesce(${playerScores.ptsPpr}, ${playerScores.ptsStd}, 0)`),
        asc(players.fullName),
      );

    const mapped: RankedPlayerForMap[] = rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      primaryPositionId: row.primaryPositionId,
      stats: normalizePlayerStats(
        (row.stats ?? {}) as Record<string, number | null>,
      ) as Record<string, number | null>,
      fantasyPts: null,
    }));

    // Apply scoring
    const scored = mapped.map((row) => ({
      ...row,
      fantasyPts: calculatePlayerPoints(
        row.stats,
        row.primaryPositionId,
        scoringRules,
      ),
    }));

    // Sort by fantasy points
    scored.sort((a, b) => {
      const diff = (b.fantasyPts ?? 0) - (a.fantasyPts ?? 0);
      if (diff !== 0) {
        return diff;
      }
      return a.fullName.localeCompare(b.fullName);
    });

    return buildFantasyPositionRankById(scored);
  },
);
