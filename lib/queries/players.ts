import { calculatePlayerPoints } from "@/lib/leagues/scoring/calculate";
import { getDefaultScoringRuleDefinitions } from "@/lib/leagues/scoring/defaults";
import { resolveScoringRuleDefinitions } from "@/lib/leagues/scoring/rules";
import { scoringStatKeysForLoad } from "@/lib/leagues/scoring/stat-keys";
import type {
  ScoringPreset,
  ScoringRuleDefinition,
} from "@/lib/leagues/scoring/types";
import { NFL_TEAMS } from "@/lib/nfl/teams";
import type { PlayerOpponent } from "@/lib/nfl/matchups";
import { getLeagueBySlug, getLeagueSeason } from "@/lib/queries/leagues";
import {
  clearScoreRowsCache,
  loadScoreRows,
  overlayScoreKind,
} from "@/lib/queries/score-rows";
import {
  clientStatAllowlist,
  pickClientStats,
} from "@/lib/rankings/pick-client-stats";
import {
  attachPositionRanks,
  hasFantasyProduction,
} from "@/lib/rankings/attach-position-ranks";
import {
  getFantasyPositionRankMap,
  getTablePositionRankMap,
  type PositionRankSource,
} from "@/lib/rankings/position-rank-map";
import {
  DEFAULT_POINTS_SORT_COLUMN,
  DEFAULT_POINTS_SORT_DESC,
} from "@/lib/rankings/sort-params";
import { sortRankedPlayers } from "@/lib/rankings/sort-ranked-players";
import {
  needsPreseasonProjectionFallback,
  PRESEASON_PROJECTION_FALLBACK_SEASON_TYPE,
  PRESEASON_PROJECTION_FALLBACK_WEEK,
  resolvePreseasonProjectedPoints,
} from "@/lib/scores/preseason-projections";

export { clearScoreRowsCache };

export type RankingsFilters = {
  season: string;
  week: number;
  kind: "projection" | "stats";
  /** player_scores.season_type — defaults to regular. */
  seasonType?: string;
  position?: string;
  team?: string;
  rookiesOnly?: boolean;
  /** Case-insensitive full-name search (trimmed). */
  search?: string;
  /** When set, only these player IDs are loaded (empty → no query). */
  playerIds?: string[];
  /** Skip these player IDs (e.g. rostered when loading FA tips). */
  excludePlayerIds?: string[];
  /**
   * Applied in memory after scoring/ranks so page slices match the UI sort.
   * Defaults to fantasy points descending.
   */
  sort?: string;
  sortDesc?: boolean;
  /** Cap rows after sort (page size). */
  limit?: number;
  /** Skip this many rows after sort. */
  offset?: number;
  /**
   * When scoping via `playerIds`, also load league-wide fantasy position ranks.
   * Opt-in: default false so roster/board/pts-only callers skip a second
   * full-week `player_scores` read (major DB egress). Pass true when RANK
   * must be league-wide on a playerId subset.
   */
  includePositionRanks?: boolean;
  /**
   * Slim score load for fantasy pts only: no sleeper join, project stats
   * jsonb to scoring keys. Skips position ranks.
   */
  pointsOnly?: boolean;
  scoringPreset?: ScoringPreset;
  scoringRules?: ScoringRuleDefinition[];
  /** Keep full normalized stats (skip client allowlist trim). */
  preserveStats?: boolean;
  /**
   * RANK source for Rankings / League Players. Projection = that week's
   * projected rank; Stats = actuals (or season actuals for unplayed weeks).
   */
  positionRanks?: PositionRankSource;
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

export async function getRankedPlayers(
  filters: RankingsFilters,
): Promise<RankedPlayerRow[]> {
  if (filters.playerIds != null && filters.playerIds.length === 0) {
    return [];
  }

  const rules =
    filters.scoringRules ??
    getDefaultScoringRuleDefinitions(filters.scoringPreset ?? "full_ppr");
  const pointsOnly = filters.pointsOnly === true;
  const statKeys = pointsOnly ? scoringStatKeysForLoad(rules) : undefined;

  // Load the full filtered set, then sort + paginate in memory so RANK (and
  // other columns) page correctly. SQL limit/offset would slice before sort.
  // pointsOnly top-N (e.g. FA tips) can push limit to SQL — ordered by provider
  // pts, then re-scored / re-sorted in memory on the smaller set.
  // Unscoped table loads use the projection pool as the player universe so
  // Projection ↔ Stats show the same people. Overlay stats when requested.
  // Scoped / pointsOnly paths keep the requested kind (roster, FA tips, etc.).
  const unscoped = filters.playerIds == null && !pointsOnly;
  const universeKind =
    unscoped && filters.kind === "stats" ? "projection" : filters.kind;
  // Preseason stats overlay the regular projection pool so Projection ↔ Stats
  // stay the same people (pre projection rows are often ADP-only / sparse).
  const overlayPreStats =
    unscoped &&
    filters.kind === "stats" &&
    (filters.seasonType ?? "regular") === "pre";

  const sharedLoad = {
    season: filters.season,
    week: overlayPreStats ? 0 : filters.week,
    seasonType: overlayPreStats ? "regular" : filters.seasonType,
    excludePlayerIds: filters.excludePlayerIds,
    search: filters.search,
    columns: pointsOnly ? ("pts" as const) : undefined,
    statKeys,
    limit: pointsOnly ? filters.limit : undefined,
    offset: pointsOnly ? filters.offset : undefined,
  };

  const universe = await loadScoreRows(
    filters.playerIds != null
      ? {
          ...sharedLoad,
          kind: filters.kind,
          playerIds: filters.playerIds,
        }
      : {
          ...sharedLoad,
          kind: universeKind,
          position: filters.position,
          team: filters.team,
          rookiesOnly: filters.rookiesOnly,
        },
  );

  let baseRows = universe;
  if (unscoped && filters.kind === "stats" && universe.length > 0) {
    const statsRows = await loadScoreRows({
      ...sharedLoad,
      week: filters.week,
      seasonType: filters.seasonType,
      kind: "stats",
      playerIds: universe.map((row) => row.id),
    });
    baseRows = overlayScoreKind(universe, statsRows);
  }

  const mapped: RankedPlayerRow[] = baseRows.map((row) => ({
    ...row,
    fantasyPts: null,
    positionRank: null,
  }));

  const scored = applyScoring(mapped, { ...filters, scoringRules: rules });

  // Empty stats: use projection fantasy ranks so RANK stays meaningful.
  const lacksProduction =
    !pointsOnly &&
    filters.kind === "stats" &&
    scored.length > 0 &&
    !hasFantasyProduction(scored);

  let fantasyRankByPlayerId: Map<string, number> | undefined;
  if (!pointsOnly && filters.positionRanks) {
    fantasyRankByPlayerId = await getTablePositionRankMap({
      season: filters.season,
      scoringRules: rules,
      source: filters.positionRanks,
    });
  } else if (lacksProduction) {
    fantasyRankByPlayerId = await getFantasyPositionRankMap({
      season: filters.season,
      week: overlayPreStats ? 0 : filters.week,
      seasonType: overlayPreStats ? "regular" : filters.seasonType,
      kind: "projection",
      scoringRules: rules,
    });
  } else if (
    !pointsOnly &&
    filters.playerIds != null &&
    filters.includePositionRanks === true
  ) {
    fantasyRankByPlayerId = await getFantasyPositionRankMap({
      season: filters.season,
      week: filters.week,
      seasonType: filters.seasonType,
      kind: filters.kind,
      scoringRules: rules,
    });
  }

  const ranked = attachPositionRanks(scored, fantasyRankByPlayerId);
  const sorted = sortRankedPlayers(
    ranked,
    filters.sort ?? DEFAULT_POINTS_SORT_COLUMN,
    filters.sortDesc ?? DEFAULT_POINTS_SORT_DESC,
  );

  const offset = Math.max(0, filters.offset ?? 0);
  const paged =
    filters.limit != null && filters.limit > 0
      ? sorted.slice(offset, offset + filters.limit)
      : offset > 0
        ? sorted.slice(offset)
        : sorted;

  if (pointsOnly) {
    return paged.map((row) => ({ ...row, stats: {} }));
  }
  if (filters.preserveStats) {
    return paged;
  }
  const allowlist = clientStatAllowlist();
  return paged.map((row) => ({
    ...row,
    stats: pickClientStats(row.stats, allowlist),
  }));
}

/**
 * Fantasy points only — slim score-row select + scoring-key jsonb projection.
 * Prefer this over `getRankedPlayers` for board / win% / duel totals.
 */
export async function getPlayerFantasyPoints(filters: {
  season: string;
  week: number;
  kind: "projection" | "stats";
  seasonType?: string;
  playerIds: string[];
  scoringRules: ScoringRuleDefinition[];
}): Promise<Map<string, number | null>> {
  if (filters.playerIds.length === 0) {
    return new Map();
  }

  const rows = await getRankedPlayers({
    season: filters.season,
    week: filters.week,
    kind: filters.kind,
    seasonType: filters.seasonType,
    playerIds: filters.playerIds,
    scoringRules: filters.scoringRules,
    pointsOnly: true,
  });

  return new Map(rows.map((row) => [row.id, row.fantasyPts]));
}

/**
 * Week projections with preseason fallback to regular W1 when pre rows lack pts.
 * Shared by Game Centre, matchup board, and My Team surfaces.
 */
export async function getWeekProjectedFantasyPoints(filters: {
  season: string;
  week: number;
  seasonType?: string;
  playerIds: string[];
  scoringRules: ScoringRuleDefinition[];
}): Promise<Map<string, number | null>> {
  const empty = new Map<string, number | null>();
  if (filters.playerIds.length === 0) {
    return empty;
  }

  const useFallback = needsPreseasonProjectionFallback(filters.seasonType);
  const [primary, fallback] = await Promise.all([
    getPlayerFantasyPoints({
      season: filters.season,
      week: filters.week,
      seasonType: filters.seasonType,
      kind: "projection",
      playerIds: filters.playerIds,
      scoringRules: filters.scoringRules,
    }).catch(() => empty),
    useFallback
      ? getPlayerFantasyPoints({
          season: filters.season,
          week: PRESEASON_PROJECTION_FALLBACK_WEEK,
          seasonType: PRESEASON_PROJECTION_FALLBACK_SEASON_TYPE,
          kind: "projection",
          playerIds: filters.playerIds,
          scoringRules: filters.scoringRules,
        }).catch(() => empty)
      : Promise.resolve(empty),
  ]);

  return useFallback
    ? resolvePreseasonProjectedPoints(primary, fallback)
    : primary;
}

function applyScoring(
  rows: RankedPlayerRow[],
  filters: RankingsFilters,
): RankedPlayerRow[] {
  const rules =
    filters.scoringRules ??
    getDefaultScoringRuleDefinitions(filters.scoringPreset ?? "full_ppr");

  return rows.map((row) => ({
    ...row,
    fantasyPts: calculatePlayerPoints(
      row.stats,
      row.primaryPositionId,
      rules,
    ),
  }));
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
