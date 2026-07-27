import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { teamWeekStats } from "@/db/schema";
import { db } from "@/lib/db";

export type TeamWeekStatsInput = {
  teamId: string;
  pointsFor: number | null;
  optimumPointsFor: number | null;
  byPosition: Record<string, number>;
};

export async function upsertTeamWeekStats(input: {
  leagueSeasonId: string;
  week: number;
  rows: TeamWeekStatsInput[];
}) {
  if (input.rows.length === 0) return;

  const now = new Date();
  await db
    .insert(teamWeekStats)
    .values(
      input.rows.map((row) => ({
        leagueSeasonId: input.leagueSeasonId,
        teamId: row.teamId,
        week: input.week,
        pointsFor: row.pointsFor,
        optimumPointsFor: row.optimumPointsFor,
        byPosition: row.byPosition,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [
        teamWeekStats.leagueSeasonId,
        teamWeekStats.teamId,
        teamWeekStats.week,
      ],
      set: {
        pointsFor: sql`excluded.points_for`,
        optimumPointsFor: sql`excluded.optimum_points_for`,
        byPosition: sql`excluded.by_position`,
        updatedAt: now,
      },
    });
}

export async function getSeasonOpfByTeamId(leagueSeasonId: string): Promise<
  Map<string, { optimumPointsFor: number; byPosition: Record<string, number> }>
> {
  const rows = await db
    .select({
      teamId: teamWeekStats.teamId,
      optimumPointsFor: teamWeekStats.optimumPointsFor,
      byPosition: teamWeekStats.byPosition,
    })
    .from(teamWeekStats)
    .where(eq(teamWeekStats.leagueSeasonId, leagueSeasonId));

  const map = new Map<
    string,
    { optimumPointsFor: number; byPosition: Record<string, number> }
  >();

  for (const row of rows) {
    const existing = map.get(row.teamId) ?? {
      optimumPointsFor: 0,
      byPosition: {},
    };
    existing.optimumPointsFor += row.optimumPointsFor ?? 0;
    for (const [pos, pts] of Object.entries(row.byPosition ?? {})) {
      existing.byPosition[pos] = (existing.byPosition[pos] ?? 0) + pts;
    }
    map.set(row.teamId, existing);
  }

  return map;
}

export async function getTeamWeeklyScoreSnapshots(input: {
  leagueSeasonId: string;
  teamId: string;
}): Promise<
  Array<{
    week: number;
    pointsFor: number | null;
    optimumPointsFor: number | null;
  }>
> {
  return db
    .select({
      week: teamWeekStats.week,
      pointsFor: teamWeekStats.pointsFor,
      optimumPointsFor: teamWeekStats.optimumPointsFor,
    })
    .from(teamWeekStats)
    .where(
      and(
        eq(teamWeekStats.leagueSeasonId, input.leagueSeasonId),
        eq(teamWeekStats.teamId, input.teamId),
      ),
    )
    .orderBy(teamWeekStats.week);
}
