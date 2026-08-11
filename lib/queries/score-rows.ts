import { and, asc, desc, eq, ilike, inArray, notInArray, sql } from "drizzle-orm";

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
/** Hard cap for unbounded week loads (offense + IDP season pools). */
export const SCORE_ROWS_HARD_CAP = 4000;
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
  /** player_scores.season_type — pre | regular | post. Defaults to regular. */
  seasonType?: string;
  playerIds?: string[];
  /** Skip these player IDs (e.g. rostered players when loading FA tips). */
  excludePlayerIds?: string[];
  limit?: number;
  offset?: number;
  /** Push position filter into SQL when set. */
  position?: string;
  team?: string;
  rookiesOnly?: boolean;
  /** Case-insensitive substring match on player full name. */
  search?: string;
  /**
   * `rank` — id / name / position / stats (no sleeper join or metadata).
   * `pts` — id / name / team / position / stats (no sleeper join or metadata).
   * Used by board/win%/FA tips and position-rank maps to cut DB egress.
   */
  columns?: "full" | "rank" | "pts";
  /**
   * When set with `rank`/`pts`, project `player_scores.stats` to these keys
   * in SQL so full week jsonb blobs never leave Postgres.
   */
  statKeys?: string[];
};

function hashFingerprint(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

function scoreRowsCacheKey(filters: LoadScoreRowsFilters) {
  const {
    season,
    week,
    kind,
    seasonType,
    playerIds,
    excludePlayerIds,
    limit,
    offset,
    position,
    team,
    rookiesOnly,
    search,
    columns,
    statKeys,
  } = filters;
  let key = `${season}|${week}|${seasonType ?? "regular"}|${kind}|cols:${columns ?? "full"}|lim:${limit ?? "all"}|off:${offset ?? 0}`;
  if (position) key += `|pos:${position}`;
  if (team && team !== "ALL") key += `|team:${team}`;
  if (rookiesOnly) key += `|rookies`;
  if (search?.trim()) key += `|q:${search.trim().toLowerCase()}`;
  if (statKeys != null && statKeys.length > 0) {
    key += `|sk:${statKeys.length}:${hashFingerprint(statKeys.join(","))}`;
  }
  if (playerIds != null) {
    const fingerprint = [...playerIds].sort().join(",");
    key += `|ids:${playerIds.length}:${hashFingerprint(fingerprint)}`;
  }
  if (excludePlayerIds != null && excludePlayerIds.length > 0) {
    const fingerprint = [...excludePlayerIds].sort().join(",");
    key += `|ex:${excludePlayerIds.length}:${hashFingerprint(fingerprint)}`;
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

function normalizeStats(raw: unknown): Record<string, number | null> {
  return normalizePlayerStats(
    (raw ?? {}) as Record<string, number | null>,
  ) as Record<string, number | null>;
}

function projectStatsSelect(statKeys: string[] | undefined) {
  if (statKeys == null || statKeys.length === 0) {
    return playerScores.stats;
  }
  return sql<Record<string, number | null>>`(
    SELECT COALESCE(jsonb_object_agg(kv.key, kv.value), '{}'::jsonb)
    FROM jsonb_each(${playerScores.stats}) AS kv
    WHERE kv.key IN (${sql.join(
      statKeys.map((key) => sql`${key}`),
      sql`, `,
    )})
  )`;
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
    eq(playerScores.seasonType, filters.seasonType ?? "regular"),
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
  if (filters.excludePlayerIds != null && filters.excludePlayerIds.length > 0) {
    whereConditions.push(notInArray(players.id, filters.excludePlayerIds));
  }
  const search = filters.search?.trim();
  if (search) {
    whereConditions.push(ilike(players.fullName, `%${search}%`));
  }

  const slim = filters.columns === "rank" || filters.columns === "pts";
  const statsSelect = projectStatsSelect(
    slim ? filters.statKeys : undefined,
  );
  let mapped: ScoreRow[];

  if (slim) {
    let query = db
      .select({
        id: players.id,
        fullName: players.fullName,
        nflTeam: players.nflTeam,
        primaryPositionId: players.primaryPositionId,
        stats: statsSelect,
        ptsPpr: playerScores.ptsPpr,
        ptsStd: playerScores.ptsStd,
      })
      .from(players)
      .innerJoin(playerScores, and(...joinConditions))
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
    mapped = rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      // Rank maps ignore team; pts/FA tips need it.
      nflTeam: filters.columns === "pts" ? row.nflTeam : null,
      primaryPositionId: row.primaryPositionId,
      sleeperId: null,
      yearsExp: null,
      byeWeek: null,
      injuryStatus: null,
      rookieYear: null,
      stats: normalizeStats(row.stats),
      ptsPpr: row.ptsPpr,
      ptsStd: row.ptsStd,
    }));
  } else {
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
    mapped = rows.map((row) => ({
      ...row,
      sleeperId: row.sleeperId ?? null,
      stats: normalizeStats(row.stats),
    }));
  }

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
