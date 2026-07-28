import { cache } from "react";

import { calculatePlayerPoints } from "@/lib/leagues/scoring/calculate";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import { loadScoreRows } from "@/lib/queries/score-rows";
import { buildFantasyPositionRankById } from "@/lib/rankings/attach-position-ranks";

type RankMapKey = {
  season: string;
  week: number;
  kind: "projection" | "stats";
  scoringRules: ScoringRuleDefinition[];
};

/**
 * Load all players for a week, score them, and return fantasy position rank by player ID.
 * Uses the shared score-row cache so roster subset loads reuse a full-week fetch.
 * Wrapped in React.cache for per-request deduplication across getRankedPlayers calls.
 */
export const getFantasyPositionRankMap = cache(
  async ({
    season,
    week,
    kind,
    scoringRules,
  }: RankMapKey): Promise<Map<string, number>> => {
    const rows = await loadScoreRows({ season, week, kind });

    const scored = rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      primaryPositionId: row.primaryPositionId,
      fantasyPts: calculatePlayerPoints(
        row.stats,
        row.primaryPositionId,
        scoringRules,
      ),
    }));

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
