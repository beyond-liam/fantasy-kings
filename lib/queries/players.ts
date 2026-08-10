import { calculatePlayerPoints } from "@/lib/leagues/scoring/calculate";
import { getDefaultScoringRuleDefinitions } from "@/lib/leagues/scoring/defaults";
import { resolveScoringRuleDefinitions } from "@/lib/leagues/scoring/rules";
import type {
  ScoringPreset,
  ScoringRuleDefinition,
} from "@/lib/leagues/scoring/types";
import { NFL_TEAMS } from "@/lib/nfl/teams";
import type { PlayerOpponent } from "@/lib/nfl/matchups";
import { playerWeekHasFantasyAppearance } from "@/lib/players/week-appearance";
import { getLeagueBySlug, getLeagueSeason } from "@/lib/queries/leagues";
import {
  clearScoreRowsCache,
  loadScoreRows,
} from "@/lib/queries/score-rows";
import {
  clientStatAllowlist,
  pickClientStats,
} from "@/lib/rankings/pick-client-stats";
import { attachPositionRanks } from "@/lib/rankings/attach-position-ranks";
import { getFantasyPositionRankMap } from "@/lib/rankings/position-rank-map";
import {
  DEFAULT_SORT_COLUMN,
  DEFAULT_SORT_DESC,
} from "@/lib/rankings/sort-params";
import { sortRankedPlayers } from "@/lib/rankings/sort-ranked-players";

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
   * Default true for table UIs; set false when only fantasyPts are needed
   * (matchup board, win% — avoids a second full-week score load).
   */
  includePositionRanks?: boolean;
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

export async function getRankedPlayers(
  filters: RankingsFilters,
): Promise<RankedPlayerRow[]> {
  if (filters.playerIds != null && filters.playerIds.length === 0) {
    return [];
  }

  // Load the full filtered set, then sort + paginate in memory so RANK (and
  // other columns) page correctly. SQL limit/offset would slice before sort.
  const baseRows = await loadScoreRows(
    filters.playerIds != null
      ? {
          season: filters.season,
          week: filters.week,
          kind: filters.kind,
          seasonType: filters.seasonType,
          playerIds: filters.playerIds,
          search: filters.search,
        }
      : {
          season: filters.season,
          week: filters.week,
          kind: filters.kind,
          seasonType: filters.seasonType,
          position: filters.position,
          team: filters.team,
          rookiesOnly: filters.rookiesOnly,
          search: filters.search,
        },
  );

  const mapped: RankedPlayerRow[] = baseRows.map((row) => ({
    ...row,
    fantasyPts: null,
    positionRank: null,
  }));

  const scored = applyScoring(mapped, filters);

  const rules =
    filters.scoringRules ??
    getDefaultScoringRuleDefinitions(filters.scoringPreset ?? "full_ppr");

  // Empty preseason stats: use projection fantasy ranks so RANK stays meaningful.
  // Historical/current stats with production: RANK follows this season's scored PTS.
  const lacksProduction =
    filters.kind === "stats" &&
    scored.length > 0 &&
    scored.every((row) => !playerWeekHasFantasyAppearance(row.stats));

  let fantasyRankByPlayerId: Map<string, number> | undefined;
  if (lacksProduction) {
    fantasyRankByPlayerId = await getFantasyPositionRankMap({
      season: filters.season,
      week: filters.week,
      kind: "projection",
      scoringRules: rules,
    });
  } else if (
    filters.playerIds != null &&
    filters.includePositionRanks !== false
  ) {
    fantasyRankByPlayerId = await getFantasyPositionRankMap({
      season: filters.season,
      week: filters.week,
      kind: filters.kind,
      scoringRules: rules,
    });
  }

  const ranked = attachPositionRanks(scored, fantasyRankByPlayerId);
  const sorted = sortRankedPlayers(
    ranked,
    filters.sort ?? DEFAULT_SORT_COLUMN,
    filters.sortDesc ?? DEFAULT_SORT_DESC,
  );

  const offset = Math.max(0, filters.offset ?? 0);
  const paged =
    filters.limit != null && filters.limit > 0
      ? sorted.slice(offset, offset + filters.limit)
      : offset > 0
        ? sorted.slice(offset)
        : sorted;

  if (filters.preserveStats) {
    return paged;
  }
  const allowlist = clientStatAllowlist();
  return paged.map((row) => ({
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
