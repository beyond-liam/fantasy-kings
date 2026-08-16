import "server-only";

import { and, eq, gte, inArray } from "drizzle-orm";

import { playerExternalIds, playerScores, players } from "@/db/schema";
import type { ScheduleSettings } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import {
  pickPlayersOfTheWeek,
  playersFromSeasonWeekTotals,
} from "@/lib/leagues/overview-players-of-the-week";
import { seasonTypesForRosterTotals } from "@/lib/leagues/roster-table-stats";
import { NFL_PRESEASON_FIRST_WEEK } from "@/lib/leagues/schedule/fantasy-week-map";
import { calculatePlayerPoints } from "@/lib/leagues/scoring/calculate";
import { normalizePlayerStats } from "@/lib/leagues/scoring/normalize-stats";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import { playerWeekHasFantasyAppearance } from "@/lib/players/week-appearance";
import { getRankedPlayers, type RankedPlayerRow } from "@/lib/queries/players";

export type { OverviewPlayerHighlight } from "@/lib/leagues/overview-players-of-the-week";

const SKILL_POSITIONS = ["QB", "RB", "WR", "TE"] as const;

async function loadWeekPlayers(input: {
  seasonYear: number;
  week: number;
  seasonType?: string;
  scoringRules: ScoringRuleDefinition[];
}) {
  return getRankedPlayers({
    season: String(input.seasonYear),
    week: input.week,
    seasonType: input.seasonType,
    kind: "stats",
    scoringRules: input.scoringRules,
    preserveStats: false,
    limit: 400,
  }).catch(() => [] as RankedPlayerRow[]);
}

function hasScoredPlayers(players: Array<{ fantasyPts: number | null }>) {
  return players.some((player) => (player.fantasyPts ?? 0) > 0);
}

export async function loadOverviewWeekHighlights(input: {
  seasonYear: number;
  week: number;
  seasonType?: string;
  scoringRules: ScoringRuleDefinition[];
}): Promise<{
  playersOfTheWeek: ReturnType<typeof pickPlayersOfTheWeek>;
  week: number;
}> {
  let week = input.week;
  const seasonType = input.seasonType;
  let players = await loadWeekPlayers({
    seasonYear: input.seasonYear,
    week,
    seasonType,
    scoringRules: input.scoringRules,
  });

  const minWeek = seasonType === "pre" ? NFL_PRESEASON_FIRST_WEEK : 1;
  // Prefer the prior week when the current slate has no scored fantasy pts yet.
  if (!hasScoredPlayers(players) && week > minWeek) {
    week = week - 1;
    players = await loadWeekPlayers({
      seasonYear: input.seasonYear,
      week,
      seasonType,
      scoringRules: input.scoringRules,
    });
  }

  return {
    playersOfTheWeek: pickPlayersOfTheWeek(players),
    week,
  };
}

export async function loadOverviewSeasonHighlights(input: {
  seasonYear: number;
  week: number;
  seasonType?: string;
  scoringRules: ScoringRuleDefinition[];
  schedule?: ScheduleSettings | null;
}): Promise<ReturnType<typeof pickPlayersOfTheWeek>> {
  const empty = pickPlayersOfTheWeek([]);
  if (input.week < 1) return empty;

  const season = String(input.seasonYear);
  const statsPoint = { week: input.week, seasonType: input.seasonType };
  const weekRows = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      sleeperId: playerExternalIds.externalId,
      primaryPositionId: players.primaryPositionId,
      nflTeam: players.nflTeam,
      week: playerScores.week,
      seasonType: playerScores.seasonType,
      stats: playerScores.stats,
    })
    .from(playerScores)
    .innerJoin(players, eq(playerScores.playerId, players.id))
    .leftJoin(
      playerExternalIds,
      and(
        eq(playerExternalIds.playerId, players.id),
        eq(playerExternalIds.provider, "sleeper"),
      ),
    )
    .where(
      and(
        eq(playerScores.season, season),
        eq(playerScores.kind, "stats"),
        gte(playerScores.week, 1),
        inArray(
          playerScores.seasonType,
          seasonTypesForRosterTotals(input.schedule, input.seasonType),
        ),
        inArray(players.primaryPositionId, [...SKILL_POSITIONS]),
      ),
    )
    .catch(() => []);

  const scoredWeeks = weekRows.map((row) => {
    const stats = normalizePlayerStats(
      (row.stats ?? {}) as Record<string, number | null>,
      { fillOmittedZeros: true },
    ) as Record<string, number | null>;
    const appeared = playerWeekHasFantasyAppearance(stats);
    return {
      id: row.id,
      fullName: row.fullName,
      sleeperId: row.sleeperId,
      primaryPositionId: row.primaryPositionId,
      nflTeam: row.nflTeam,
      week: row.week,
      seasonType: row.seasonType,
      fantasyPts: appeared
        ? calculatePlayerPoints(stats, row.primaryPositionId, input.scoringRules)
        : null,
    };
  });

  const totals = playersFromSeasonWeekTotals(scoredWeeks, statsPoint);
  if (hasScoredPlayers(totals)) {
    return pickPlayersOfTheWeek(totals);
  }

  // Provider season totals (week 0) when weekly rows have not landed yet.
  const seasonTotals = await loadWeekPlayers({
    seasonYear: input.seasonYear,
    week: 0,
    seasonType: input.seasonType,
    scoringRules: input.scoringRules,
  });
  return pickPlayersOfTheWeek(seasonTotals);
}
