import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
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
import {
  attachPositionRanks,
  buildFantasyPositionRankById,
} from "@/lib/rankings/attach-position-ranks";

export type RankingsFilters = {
  season: string;
  week: number;
  kind: "projection" | "stats";
  position?: string;
  team?: string;
  rookiesOnly?: boolean;
  /** When set, only these player IDs are loaded (empty → no query). */
  playerIds?: string[];
  /** Cap rows from player_scores (ordered by fantasy pts). */
  limit?: number;
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
 * Cross-request cache for raw score rows keyed by season/week/kind
 * (and optional player-id set hash).
 *
 * Size fits one NFL season of weekly proj+stats (~34) plus season-long
 * and a few extras so schedule enrichment / multi-week pages do not
 * thrash mid-request. Projections TTL is long; live stats refresh often.
 */
const SCORE_CACHE_TTL_MS = {
  projection: 15 * 60 * 1000,
  stats: 60 * 1000,
} as const;
/** ~17 weeks × 2 kinds + season row + headroom across warm instances. */
const SCORE_CACHE_MAX_ENTRIES = 48;
const scoreRowsCache = new Map<
  string,
  { rows: BaseScoreRow[]; loadedAt: number }
>();

/** Drop cached score rows after a sync (or in tests). */
export function clearScoreRowsCache() {
  scoreRowsCache.clear();
}

function scoreRowsCacheKey(
  season: string,
  week: number,
  kind: "projection" | "stats",
  playerIds?: string[],
) {
  if (playerIds == null) {
    return `${season}|${week}|${kind}`;
  }
  // Stable short fingerprint — full UUID lists are too large as map keys.
  const fingerprint = [...playerIds].sort().join(",");
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    hash = (hash * 31 + fingerprint.charCodeAt(i)) | 0;
  }
  return `${season}|${week}|${kind}|ids:${playerIds.length}:${hash.toString(36)}`;
}

async function loadScoreRows(
  season: string,
  week: number,
  kind: "projection" | "stats",
  playerIds?: string[],
  limit?: number,
): Promise<BaseScoreRow[]> {
  if (playerIds != null && playerIds.length === 0) {
    return [];
  }

  const key = `${scoreRowsCacheKey(season, week, kind, playerIds)}|lim:${limit ?? "all"}`;
  const cached = scoreRowsCache.get(key);
  if (cached && Date.now() - cached.loadedAt < SCORE_CACHE_TTL_MS[kind]) {
    return cached.rows;
  }

  const query = db
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
        ...(playerIds != null
          ? [inArray(playerScores.playerId, playerIds)]
          : []),
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

  const rows =
    limit != null && limit > 0 ? await query.limit(limit) : await query;

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
    filters.playerIds,
    filters.limit,
  );

  const filtered = baseRows.filter((row) => {
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

  const scored = applyScoring(mapped, filters);

  // Roster/FA subset loads must still use league-wide fantasy position ranks.
  let fantasyRankByPlayerId: Map<string, number> | undefined;
  if (filters.playerIds != null) {
    const leagueBase = await loadScoreRows(
      filters.season,
      filters.week,
      filters.kind,
      undefined,
      undefined,
    );
    const leagueMapped: RankedPlayerRow[] = leagueBase.map((row) => ({
      ...row,
      fantasyPts: null,
      positionRank: null,
    }));
    fantasyRankByPlayerId = buildFantasyPositionRankById(
      applyScoring(leagueMapped, {
        ...filters,
        playerIds: undefined,
        position: undefined,
        team: undefined,
        rookiesOnly: false,
        limit: undefined,
      }),
    );
  }

  const ranked = attachPositionRanks(scored, fantasyRankByPlayerId);
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
