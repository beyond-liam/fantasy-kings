import { and, asc, desc, eq, sql } from "drizzle-orm";
import { playerExternalIds, playerScores, players } from "@/db/schema";
import { db } from "@/lib/db";
import { calculatePlayerPoints } from "@/lib/leagues/scoring/calculate";
import { getDefaultScoringRuleDefinitions } from "@/lib/leagues/scoring/defaults";
import { normalizePlayerStats } from "@/lib/leagues/scoring/normalize-stats";
import { resolveScoringRuleDefinitions } from "@/lib/leagues/scoring/rules";
import type {
  ScoringPreset,
  ScoringRuleDefinition,
} from "@/lib/leagues/scoring/types";
import { NFL_TEAMS } from "@/lib/nfl/teams";
import type { PlayerOpponent } from "@/lib/nfl/matchups";
import { getLeagueBySlug, getLeagueSeason } from "@/lib/queries/leagues";
import {
  clientStatAllowlist,
  pickClientStats,
} from "@/lib/rankings/pick-client-stats";

export type RankingsFilters = {
  season: string;
  week: number;
  kind: "projection" | "stats";
  position?: string;
  team?: string;
  rookiesOnly?: boolean;
  /** When set, only these player IDs are loaded (empty → no query). */
  playerIds?: string[];
  scoringPreset?: ScoringPreset;
  scoringRules?: ScoringRuleDefinition[];
  /** Keep full normalized stats (skip client allowlist trim). */
  preserveStats?: boolean;
};

export type RankedPlayerRow = {
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
  fantasyPts: number | null;
  positionRank: number | null;
  /** League context only — fantasy team that owns the player. */
  fantasyTeamId?: string | null;
  fantasyTeamName?: string | null;
  fantasyTeamSlug?: string | null;
  isOwnedByCurrentUser?: boolean;
  onWaivers?: boolean;
  acquisitionKind?: "add" | "claim" | "owned" | "unavailable";
  hasPendingClaim?: boolean;
  opponent?: PlayerOpponent | null;
};

export async function getNflTeams(): Promise<string[]> {
  return [...NFL_TEAMS];
}

type BaseScoreRow = Omit<RankedPlayerRow, "fantasyPts" | "positionRank">;

/**
 * Cross-request cache for raw score rows keyed by season/week/kind.
 * Projections change slowly; live `stats` refresh via cron during games.
 */
const SCORE_CACHE_TTL_MS = {
  projection: 15 * 60 * 1000,
  stats: 60 * 1000,
} as const;
const SCORE_CACHE_MAX_ENTRIES = 8;
const scoreRowsCache = new Map<
  string,
  { rows: BaseScoreRow[]; loadedAt: number }
>();

/** Drop cached score rows after a sync (or in tests). */
export function clearScoreRowsCache() {
  scoreRowsCache.clear();
}

async function loadScoreRows(
  season: string,
  week: number,
  kind: "projection" | "stats",
): Promise<BaseScoreRow[]> {
  const key = `${season}|${week}|${kind}`;
  const cached = scoreRowsCache.get(key);
  if (cached && Date.now() - cached.loadedAt < SCORE_CACHE_TTL_MS[kind]) {
    return cached.rows;
  }

  const rows = await db
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

  const mapped: BaseScoreRow[] = rows.map((row) => ({
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

export async function getRankedPlayers(
  filters: RankingsFilters,
): Promise<RankedPlayerRow[]> {
  if (filters.playerIds != null && filters.playerIds.length === 0) {
    return [];
  }

  const baseRows = await loadScoreRows(
    filters.season,
    filters.week,
    filters.kind,
  );

  const playerIdSet =
    filters.playerIds != null ? new Set(filters.playerIds) : null;

  const filtered = baseRows.filter((row) => {
    if (playerIdSet && !playerIdSet.has(row.id)) {
      return false;
    }
    if (filters.position && row.primaryPositionId !== filters.position) {
      return false;
    }
    if (
      filters.team &&
      filters.team !== "ALL" &&
      row.nflTeam !== filters.team
    ) {
      return false;
    }
    if (filters.rookiesOnly && row.yearsExp !== 0) {
      return false;
    }
    return true;
  });

  const mapped: RankedPlayerRow[] = filtered.map((row) => ({
    ...row,
    fantasyPts: null,
    positionRank: null,
  }));

  const ranked = attachPositionRanks(applyScoring(mapped, filters));
  if (filters.preserveStats) {
    return ranked;
  }
  const allowlist = clientStatAllowlist();
  return ranked.map((row) => ({
    ...row,
    stats: pickClientStats(row.stats, allowlist),
  }));
}

function applyScoring(
  rows: RankedPlayerRow[],
  filters: RankingsFilters,
): RankedPlayerRow[] {
  const rules =
    filters.scoringRules ??
    getDefaultScoringRuleDefinitions(filters.scoringPreset ?? "full_ppr");

  const scored = rows.map((row) => ({
    ...row,
    fantasyPts: calculatePlayerPoints(
      row.stats,
      row.primaryPositionId,
      rules,
    ),
  }));

  return scored.sort((a, b) => {
    const diff = (b.fantasyPts ?? 0) - (a.fantasyPts ?? 0);
    if (diff !== 0) {
      return diff;
    }

    return a.fullName.localeCompare(b.fullName);
  });
}

export async function getLeagueScoredPlayers(
  slug: string,
  filters: Omit<RankingsFilters, "scoringPreset" | "scoringRules">,
): Promise<{
  players: RankedPlayerRow[];
  scoringPreset: ScoringPreset;
} | null> {
  const league = await getLeagueBySlug(slug);
  if (!league) {
    return null;
  }

  const season = await getLeagueSeason(league.id);
  if (!season) {
    return null;
  }

  const scoringPreset = season.scoringPreset as ScoringPreset;
  const scoringRules = resolveScoringRuleDefinitions(
    scoringPreset,
    season.settings.scoringRules,
  );

  const rankedPlayers = await getRankedPlayers({
    ...filters,
    scoringRules,
  });

  return { players: rankedPlayers, scoringPreset };
}

function attachPositionRanks(
  rows: RankedPlayerRow[],
): RankedPlayerRow[] {
  const grouped = new Map<string, RankedPlayerRow[]>();

  for (const row of rows) {
    const group = grouped.get(row.primaryPositionId) ?? [];
    group.push(row);
    grouped.set(row.primaryPositionId, group);
  }

  const rankByPlayerId = new Map<string, number>();

  for (const [, group] of grouped) {
    const sorted = [...group].sort(
      (a, b) => (b.fantasyPts ?? 0) - (a.fantasyPts ?? 0),
    );

    sorted.forEach((row, index) => {
      rankByPlayerId.set(row.id, index + 1);
    });
  }

  return rows.map((row) => {
    const sleeperRank =
      row.stats.pos_rank_ppr ??
      row.stats.pos_rank_std ??
      row.stats.pos_adp_dd_ppr ??
      row.stats.pos_rank_half_ppr;

    const positionRank =
      sleeperRank && sleeperRank > 0 && sleeperRank < 999
        ? Math.round(sleeperRank)
        : (rankByPlayerId.get(row.id) ?? null);

    return { ...row, positionRank };
  });
}
