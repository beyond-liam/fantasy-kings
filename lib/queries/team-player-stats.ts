import { and, eq, gte, inArray } from "drizzle-orm";

import { playerScores, players } from "@/db/schema";
import type { ScheduleSettings } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import type { PlayerScoreNflState } from "@/lib/leagues/schedule/player-score-point";
import {
  accumulateRosterSeasonTotals,
  seasonTypesForRosterTotals,
  type RosterWeekScore,
} from "@/lib/leagues/roster-table-stats";
import { calculatePlayerPoints } from "@/lib/leagues/scoring/calculate";
import { normalizePlayerStats } from "@/lib/leagues/scoring/normalize-stats";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import {
  overlayTeamPlayerStatRows,
  resolveTeamPlayerStatsSource,
} from "@/lib/leagues/team-stats";
import { playerWeekHasFantasyAppearance } from "@/lib/players/week-appearance";
import {
  getRankedPlayers,
  type RankedPlayerRow,
} from "@/lib/queries/players";
import { getTablePositionRankMap } from "@/lib/rankings/position-rank-map";

/** Roster Player Stats: same RANK source as League Players Stats. */
export async function getTeamRosterStatPlayers(input: {
  season: string;
  playerIds: string[];
  scoringRules: ScoringRuleDefinition[];
  nfl: PlayerScoreNflState;
  schedule?: ScheduleSettings | null;
}): Promise<RankedPlayerRow[]> {
  if (input.playerIds.length === 0) {
    return [];
  }

  const source = resolveTeamPlayerStatsSource({
    nfl: input.nfl,
    schedule: input.schedule,
    seasonYear: Number(input.season),
  });

  const rankedPromise = getRankedPlayers({
    season: input.season,
    week: source.week,
    seasonType: source.seasonType,
    kind: source.kind,
    scoringRules: input.scoringRules,
    playerIds: input.playerIds,
    includePositionRanks: true,
    positionRanks: source.positionRanks,
  });

  if (source.kind === "projection") {
    return rankedPromise;
  }

  const [actuals, universe] = await Promise.all([
    rankedPromise,
    getRankedPlayers({
      season: input.season,
      week: 0,
      seasonType: "regular",
      kind: "projection",
      scoringRules: input.scoringRules,
      playerIds: input.playerIds,
      includePositionRanks: true,
      positionRanks: source.positionRanks,
    }),
  ]);

  return overlayTeamPlayerStatRows(universe, actuals);
}

export type RosterTableStat = {
  positionRank: number | null;
  fantasyPts: number | null;
  avgPts: number | null;
};

/** League-wide RANK plus season FPTS / AVG for roster and watchlist tables. */
export async function getRosterTableStatMap(input: {
  season: string;
  playerIds: string[];
  scoringRules: ScoringRuleDefinition[];
  nfl: PlayerScoreNflState;
  schedule?: ScheduleSettings | null;
}): Promise<Map<string, RosterTableStat>> {
  const empty = new Map<string, RosterTableStat>();
  if (input.playerIds.length === 0) {
    return empty;
  }

  const source = resolveTeamPlayerStatsSource({
    nfl: input.nfl,
    schedule: input.schedule,
    seasonYear: Number(input.season),
  });

  const rankPromise = getTablePositionRankMap({
    season: input.season,
    scoringRules: input.scoringRules,
    source: source.positionRanks,
  });

  const totalsPromise =
    source.kind === "stats"
      ? db
          .select({
            playerId: playerScores.playerId,
            week: playerScores.week,
            seasonType: playerScores.seasonType,
            stats: playerScores.stats,
            primaryPositionId: players.primaryPositionId,
          })
          .from(playerScores)
          .innerJoin(players, eq(playerScores.playerId, players.id))
          .where(
            and(
              inArray(playerScores.playerId, input.playerIds),
              eq(playerScores.season, input.season),
              eq(playerScores.kind, "stats"),
              gte(playerScores.week, 1),
              inArray(
                playerScores.seasonType,
                seasonTypesForRosterTotals(input.schedule, source.seasonType),
              ),
            ),
          )
      : Promise.resolve([]);

  const [ranks, weekRows] = await Promise.all([rankPromise, totalsPromise]);
  const scoredWeeks: RosterWeekScore[] = weekRows.map((row) => {
    const stats = normalizePlayerStats(
      (row.stats ?? {}) as Record<string, number | null>,
      { fillOmittedZeros: true },
    ) as Record<string, number | null>;
    const appeared = playerWeekHasFantasyAppearance(stats);
    return {
      playerId: row.playerId,
      week: row.week,
      seasonType: row.seasonType,
      appeared,
      fantasyPts: appeared
        ? calculatePlayerPoints(stats, row.primaryPositionId, input.scoringRules)
        : null,
    };
  });
  const totals = accumulateRosterSeasonTotals(scoredWeeks, {
    week: source.week,
    seasonType: source.seasonType,
  });

  const result = new Map<string, RosterTableStat>();
  for (const playerId of input.playerIds) {
    const season = totals.get(playerId);
    result.set(playerId, {
      positionRank: ranks.get(playerId) ?? null,
      fantasyPts: season?.fantasyPts ?? null,
      avgPts: season?.avgPts ?? null,
    });
  }
  return result;
}

export function withRosterTableStats<T extends { id: string }>(
  player: T,
  stats: Map<string, RosterTableStat>,
): T & RosterTableStat {
  const row = stats.get(player.id);
  return {
    ...player,
    positionRank: row?.positionRank ?? null,
    fantasyPts: row?.fantasyPts ?? null,
    avgPts: row?.avgPts ?? null,
  };
}
