import { createProcessCache } from "@/lib/cache/process-cache";

type RankMapEntries = Array<[string, number]>;

/** Align with stats score-row TTL — ranks shift as live stats update. */
const HYBRID_RANK_TTL_MS = 60 * 1000;

/** Projection ranks change less often mid-week. */
const PROJECTION_RANK_TTL_MS = 15 * 60 * 1000;

export const getCachedHybridRankEntries = createProcessCache<RankMapEntries>({
  ttlMs: HYBRID_RANK_TTL_MS,
  maxEntries: 48,
});

export const getCachedFantasyRankEntries = createProcessCache<RankMapEntries>({
  ttlMs: PROJECTION_RANK_TTL_MS,
  maxEntries: 48,
});

export function rankMapFromEntries(
  entries: RankMapEntries,
): Map<string, number> {
  return new Map(entries);
}

export function rankMapToEntries(map: Map<string, number>): RankMapEntries {
  return [...map.entries()];
}

export function hybridRankProcessCacheKey(input: {
  season: string;
  week: number;
  seasonType?: string;
  scoringRules: unknown;
}): string {
  return `${input.season}|${input.week}|${input.seasonType ?? "regular"}|${JSON.stringify(input.scoringRules)}`;
}

export function fantasyRankProcessCacheKey(input: {
  season: string;
  week: number;
  kind: "projection" | "stats";
  seasonType?: string;
  scoringRules: unknown;
}): string {
  return `${input.season}|${input.week}|${input.kind}|${input.seasonType ?? "regular"}|${JSON.stringify(input.scoringRules)}`;
}
