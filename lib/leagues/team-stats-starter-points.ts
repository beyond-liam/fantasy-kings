import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { playerScores, players, teamWeekLineups } from "@/db/schema";
import { db } from "@/lib/db";
import { calculatePlayerPoints } from "@/lib/leagues/scoring/calculate";
import { resolveScoringRuleDefinitions } from "@/lib/leagues/scoring/rules";
import type { ScoringPreset } from "@/lib/leagues/scoring/types";
import type { StarterPlayerSeasonPoints } from "@/lib/leagues/team-stats-charts";

/**
 * Season starter fantasy points by player from week-locked lineup snapshots.
 * Returns [] when no snapshots exist (legacy weeks / pre-006 seasons).
 */
export async function getTeamSeasonStarterPoints(input: {
  leagueSeasonId: string;
  teamId: string;
  seasonYear: number;
  scoringPreset: string;
  scoringRules?: unknown;
}): Promise<StarterPlayerSeasonPoints[]> {
  const lineupRows = await db
    .select({
      week: teamWeekLineups.week,
      playerId: teamWeekLineups.playerId,
    })
    .from(teamWeekLineups)
    .where(
      and(
        eq(teamWeekLineups.leagueSeasonId, input.leagueSeasonId),
        eq(teamWeekLineups.teamId, input.teamId),
      ),
    );

  if (lineupRows.length === 0) return [];

  const playerIds = [...new Set(lineupRows.map((row) => row.playerId))];
  const weeks = [...new Set(lineupRows.map((row) => row.week))];

  const [playerRows, scoreRows] = await Promise.all([
    db
      .select({
        id: players.id,
        fullName: players.fullName,
        primaryPositionId: players.primaryPositionId,
      })
      .from(players)
      .where(inArray(players.id, playerIds)),
    db
      .select({
        playerId: playerScores.playerId,
        week: playerScores.week,
        stats: playerScores.stats,
        ptsPpr: playerScores.ptsPpr,
        ptsStd: playerScores.ptsStd,
      })
      .from(playerScores)
      .where(
        and(
          inArray(playerScores.playerId, playerIds),
          eq(playerScores.season, String(input.seasonYear)),
          inArray(playerScores.week, weeks),
          eq(playerScores.kind, "stats"),
          eq(playerScores.seasonType, "regular"),
        ),
      ),
  ]);

  const playerById = new Map(playerRows.map((p) => [p.id, p]));
  const scoringRules = resolveScoringRuleDefinitions(
    input.scoringPreset as ScoringPreset,
    input.scoringRules as never,
  );

  const scoreByPlayerWeek = new Map<string, number>();
  for (const row of scoreRows) {
    const player = playerById.get(row.playerId);
    if (!player) continue;
    const stats = (row.stats ?? {}) as Record<string, number | null>;
    let pts = calculatePlayerPoints(
      stats,
      player.primaryPositionId,
      scoringRules,
    );
    if (pts === 0 && Object.keys(stats).length === 0) {
      pts = row.ptsPpr ?? row.ptsStd ?? 0;
    }
    scoreByPlayerWeek.set(`${row.playerId}:${row.week}`, pts);
  }

  const totals = new Map<string, number>();
  for (const row of lineupRows) {
    const pts = scoreByPlayerWeek.get(`${row.playerId}:${row.week}`) ?? 0;
    totals.set(row.playerId, (totals.get(row.playerId) ?? 0) + pts);
  }

  return [...totals.entries()]
    .map(([playerId, points]) => {
      const player = playerById.get(playerId);
      return {
        playerId,
        fullName: player?.fullName ?? "Unknown",
        points: Math.round(points * 10) / 10,
      };
    })
    .filter((row) => row.points > 0);
}
