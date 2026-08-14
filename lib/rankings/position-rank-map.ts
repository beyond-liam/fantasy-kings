import { cache } from "react";

import { calculatePlayerPoints } from "@/lib/leagues/scoring/calculate";
import { scoringStatKeysForLoad } from "@/lib/leagues/scoring/stat-keys";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import { playerWeekHasFantasyAppearance } from "@/lib/players/week-appearance";
import { loadScoreRows } from "@/lib/queries/score-rows";
import {
  buildFantasyPositionRankById,
  buildHybridPositionRankById,
  type HybridPositionRankRow,
} from "@/lib/rankings/attach-position-ranks";
import type { PositionRankSource } from "@/lib/rankings/table-rank-source";

export type { PositionRankSource };
export { resolveTablePositionRanks } from "@/lib/rankings/table-rank-source";

type RankMapKey = {
  season: string;
  week: number;
  kind: "projection" | "stats";
  seasonType?: string;
  scoringRules: ScoringRuleDefinition[];
};

/**
 * Load all players for a week, score them, and return fantasy position rank by player ID.
 * Uses the shared score-row cache so roster subset loads reuse a full-week fetch.
 * Wrapped in React.cache for per-request deduplication across getRankedPlayers calls.
 *
 * Stats loads keep full jsonb (no scoring-key slim) so actual ranks match table PTS.
 */
export const getFantasyPositionRankMap = cache(
  async ({
    season,
    week,
    kind,
    seasonType,
    scoringRules,
  }: RankMapKey): Promise<Map<string, number>> => {
    const rows = await loadScoreRows({
      season,
      week,
      kind,
      seasonType,
      columns: "rank",
      statKeys:
        kind === "stats" ? undefined : scoringStatKeysForLoad(scoringRules),
    });

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

type HybridRankMapKey = {
  season: string;
  week: number;
  seasonType?: string;
  scoringRules: ScoringRuleDefinition[];
};

/**
 * Stats RANK: appeared players with points > 0 by actuals, then unplayed in projection order.
 */
export const getHybridPositionRankMap = cache(
  async ({
    season,
    week,
    seasonType,
    scoringRules,
  }: HybridRankMapKey): Promise<Map<string, number>> => {
    const [projections, stats] = await Promise.all([
      loadScoreRows({
        season,
        week: 0,
        kind: "projection",
        seasonType: "regular",
        columns: "rank",
        statKeys: scoringStatKeysForLoad(scoringRules),
      }),
      loadScoreRows({
        season,
        week,
        kind: "stats",
        seasonType,
        columns: "rank",
      }),
    ]);

    const projectedById = new Map(
      projections.map((row) => [
        row.id,
        calculatePlayerPoints(row.stats, row.primaryPositionId, scoringRules),
      ]),
    );
    const statsById = new Map(stats.map((row) => [row.id, row]));
    const rows = new Map<string, HybridPositionRankRow>();

    for (const row of projections) {
      const actual = statsById.get(row.id);
      const appeared = actual
        ? playerWeekHasFantasyAppearance(actual.stats)
        : false;
      rows.set(row.id, {
        id: row.id,
        fullName: row.fullName,
        primaryPositionId: row.primaryPositionId,
        actualPts:
          appeared && actual
            ? calculatePlayerPoints(
                actual.stats,
                row.primaryPositionId,
                scoringRules,
              )
            : null,
        projectedPts: projectedById.get(row.id) ?? null,
        appeared,
      });
    }

    for (const row of stats) {
      if (rows.has(row.id)) continue;
      const appeared = playerWeekHasFantasyAppearance(row.stats);
      rows.set(row.id, {
        id: row.id,
        fullName: row.fullName,
        primaryPositionId: row.primaryPositionId,
        actualPts: appeared
          ? calculatePlayerPoints(
              row.stats,
              row.primaryPositionId,
              scoringRules,
            )
          : null,
        projectedPts: null,
        appeared,
      });
    }

    return buildHybridPositionRankById([...rows.values()]);
  },
);

/** RANK for the resolved source. Stats uses hybrid (actuals, then projections). */
export async function getTablePositionRankMap(input: {
  season: string;
  scoringRules: ScoringRuleDefinition[];
  source: PositionRankSource;
}): Promise<Map<string, number>> {
  if (input.source.kind === "stats") {
    return getHybridPositionRankMap({
      season: input.season,
      week: input.source.week,
      seasonType: input.source.seasonType,
      scoringRules: input.scoringRules,
    });
  }

  return getFantasyPositionRankMap({
    season: input.season,
    week: input.source.week,
    kind: input.source.kind,
    seasonType: input.source.seasonType,
    scoringRules: input.scoringRules,
  });
}
