import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { playerExternalIds, playerScores, players } from "@/db/schema";
import { db } from "@/lib/db";
import { normalizePlayerStats } from "@/lib/leagues/scoring/normalize-stats";

export type ScoreRow = {
  id: string;
  fullName: string;
  nflTeam: string | null;
  primaryPositionId: string;
  sleeperId: string | null;
  yearsExp: number | null;
  byeWeek: number | null;
  injuryStatus: string | null;
  rookieYear: string | null;
  stats: Record<string, number | null>;
  ptsPpr: number | null;
  ptsStd: number | null;
};

/**
 * Cross-request cache for raw score rows keyed by season/week/kind
 * (and optional player-id / filter fingerprint).
 */
const SCORE_CACHE_TTL_MS = {
  projection: 15 * 60 * 1000,
  stats: 60 * 1000,
} as const;
const SCORE_CACHE_MAX_ENTRIES = 48;
/** Hard cap for unbounded week loads (covers a full NFL scoring week). */
export const SCORE_ROWS_HARD_CAP = 800;
const scoreRowsCache = new Map<
  string,
  { rows: ScoreRow[]; loadedAt: number }
>();

/** Drop cached score rows after a sync (or in tests). */
export function clearScoreRowsCache() {
  scoreRowsCache.clear();
}

export type LoadScoreRowsFilters = {
  season: string;
  week: number;
  kind: "projection" | "stats";
  playerIds?: string[];
  limit?: number;
  offset?: number;
  /** Push position filter into SQL when set. */
  position?: string;
  team?: string;
  rookiesOnly?: boolean;
};

function scoreRowsCacheKey(filters: LoadScoreRowsFilters) {
  const {
    season,
    week,
    kind,
    playerIds,
    limit,
    offset,
    position,
    team,
    rookiesOnly,
  } = filters;
  let key = `${season}|${week}|${kind}|lim:${limit ?? "all"}|off:${offset ?? 0}`;
  if (position) key += `|pos:${position}`;
  if (team && team !== "ALL") key += `|team:${team}`;
  if (rookiesOnly) key += `|rookies`;
  if (playerIds != null) {
    const fingerprint = [...playerIds].sort().join(",");
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      hash = (hash * 31 + fingerprint.charCodeAt(i)) | 0;
    }
    key += `|ids:${playerIds.length}:${hash.toString(36)}`;
  }
  return key;
}

function resolveScoreRowsLimit(filters: LoadScoreRowsFilters): number {
  if (filters.playerIds != null) {
    const scoped = Math.max(filters.playerIds.length, 1);
    if (filters.limit != null && filters.limit > 0) {
      return Math.min(filters.limit, SCORE_ROWS_HARD_CAP, scoped);
    }
    return Math.min(scoped, SCORE_ROWS_HARD_CAP);
  }
  if (filters.limit != null && filters.limit > 0) {
    return Math.min(filters.limit, SCORE_ROWS_HARD_CAP);
  }
  return SCORE_ROWS_HARD_CAP;
}

/** Load (and cache) player_scores joined to players for a week. */
export async function loadScoreRows(
  filters: LoadScoreRowsFilters,
): Promise<ScoreRow[]> {
  if (filters.playerIds != null && filters.playerIds.length === 0) {
    return [];
  }

  const effectiveLimit = resolveScoreRowsLimit(filters);
  const key = scoreRowsCacheKey({ ...filters, limit: effectiveLimit });
  const cached = scoreRowsCache.get(key);
  if (
    cached &&
    Date.now() - cached.loadedAt < SCORE_CACHE_TTL_MS[filters.kind]
  ) {
    return cached.rows;
  }

  const joinConditions = [
    eq(playerScores.playerId, players.id),
    eq(playerScores.season, filters.season),
    eq(playerScores.week, filters.week),
    eq(playerScores.kind, filters.kind),
    eq(playerScores.seasonType, "regular"),
  ];
  if (filters.playerIds != null) {
    joinConditions.push(inArray(playerScores.playerId, filters.playerIds));
  }

  const whereConditions = [];
  if (filters.position) {
    whereConditions.push(eq(players.primaryPositionId, filters.position));
  }
  if (filters.team && filters.team !== "ALL") {
    whereConditions.push(eq(players.nflTeam, filters.team));
  }
  if (filters.rookiesOnly) {
    whereConditions.push(eq(players.yearsExp, 0));
  }

  let query = db
    .select({
      id: players.id,
      fullName: players.fullName,
      nflTeam: players.nflTeam,
      primaryPositionId: players.primaryPositionId,
      sleeperId: playerExternalIds.externalId,
      yearsExp: players.yearsExp,
      byeWeek: players.byeWeek,
      injuryStatus: players.injuryStatus,
      rookieYear: players.rookieYear,
      stats: playerScores.stats,
      ptsPpr: playerScores.ptsPpr,
      ptsStd: playerScores.ptsStd,
    })
    .from(players)
    .innerJoin(playerScores, and(...joinConditions))
    .leftJoin(
      playerExternalIds,
      and(
        eq(playerExternalIds.playerId, players.id),
        eq(playerExternalIds.provider, "sleeper"),
      ),
    )
    .$dynamic();

  if (whereConditions.length > 0) {
    query = query.where(and(...whereConditions));
  }

  query = query.orderBy(
    desc(sql`coalesce(${playerScores.ptsPpr}, ${playerScores.ptsStd}, 0)`),
    asc(players.fullName),
  );

  if (filters.offset != null && filters.offset > 0) {
    query = query.offset(filters.offset);
  }

  const rows = await query.limit(effectiveLimit);

  const mapped: ScoreRow[] = rows.map((row) => ({
    ...row,
    sleeperId: row.sleeperId ?? null,
    stats: normalizePlayerStats(
      (row.stats ?? {}) as Record<string, number | null>,
    ) as Record<string, number | null>,
  }));

  if (scoreRowsCache.size >= SCORE_CACHE_MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [entryKey, entry] of scoreRowsCache) {
      if (entry.loadedAt < oldestAt) {
        oldestAt = entry.loadedAt;
        oldestKey = entryKey;
      }
    }
    if (oldestKey) {
      scoreRowsCache.delete(oldestKey);
    }
  }
  scoreRowsCache.set(key, { rows: mapped, loadedAt: Date.now() });

  return mapped;
}
