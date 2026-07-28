import { calculatePlayerPoints } from "@/lib/leagues/scoring/calculate";
import { getDefaultScoringRuleDefinitions } from "@/lib/leagues/scoring/defaults";
import { resolveScoringRuleDefinitions } from "@/lib/leagues/scoring/rules";
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
} from "@/lib/queries/score-rows";
import {
  clientStatAllowlist,
  pickClientStats,
} from "@/lib/rankings/pick-client-stats";
import { attachPositionRanks } from "@/lib/rankings/attach-position-ranks";
import { getFantasyPositionRankMap } from "@/lib/rankings/position-rank-map";

export { clearScoreRowsCache };

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
  /** Skip this many rows after filters (SQL offset). */
  offset?: number;
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

  // When scoping to playerIds, ranks must stay league-wide — load the subset
  // only. Otherwise push position/team/rookies into SQL.
  const baseRows = await loadScoreRows(
    filters.playerIds != null
      ? {
          season: filters.season,
          week: filters.week,
          kind: filters.kind,
          playerIds: filters.playerIds,
          limit: filters.limit,
          offset: filters.offset,
        }
      : {
          season: filters.season,
          week: filters.week,
          kind: filters.kind,
          limit: filters.limit,
          offset: filters.offset,
          position: filters.position,
          team: filters.team,
          rookiesOnly: filters.rookiesOnly,
        },
  );

  const mapped: RankedPlayerRow[] = baseRows.map((row) => ({
    ...row,
    fantasyPts: null,
    positionRank: null,
  }));

  const scored = applyScoring(mapped, filters);

  // Roster/FA subset loads must still use league-wide fantasy position ranks.
  let fantasyRankByPlayerId: Map<string, number> | undefined;
  if (filters.playerIds != null) {
    const rules =
      filters.scoringRules ??
      getDefaultScoringRuleDefinitions(filters.scoringPreset ?? "full_ppr");
    fantasyRankByPlayerId = await getFantasyPositionRankMap({
      season: filters.season,
      week: filters.week,
      kind: filters.kind,
      scoringRules: rules,
    });
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
