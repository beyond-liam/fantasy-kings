import "server-only";

import { and, eq } from "drizzle-orm";

import { teamWeekLineups, type TeamWeekLineup } from "@/db/schema";
import { db } from "@/lib/db";

/**
 * Store frozen lineup when a matchup is first finalized.
 * Idempotent: only inserts if no rows exist for (season, team, week).
 */
export async function upsertTeamWeekLineup(input: {
  leagueSeasonId: string;
  teamId: string;
  week: number;
  starters: Array<{ playerId: string; slotPositionId?: string | null }>;
}): Promise<void> {
  if (input.starters.length === 0) return;

  const existing = await db
    .select({ id: teamWeekLineups.id })
    .from(teamWeekLineups)
    .where(
      and(
        eq(teamWeekLineups.leagueSeasonId, input.leagueSeasonId),
        eq(teamWeekLineups.teamId, input.teamId),
        eq(teamWeekLineups.week, input.week),
      ),
    )
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(teamWeekLineups).values(
    input.starters.map((starter) => ({
      leagueSeasonId: input.leagueSeasonId,
      teamId: input.teamId,
      week: input.week,
      playerId: starter.playerId,
      slotPositionId: starter.slotPositionId ?? null,
    })),
  );
}

/** Load snapshotted lineup for a team/week. Returns null if none. */
export async function loadTeamWeekLineup(input: {
  leagueSeasonId: string;
  teamId: string;
  week: number;
}): Promise<TeamWeekLineup[] | null> {
  const rows = await db
    .select()
    .from(teamWeekLineups)
    .where(
      and(
        eq(teamWeekLineups.leagueSeasonId, input.leagueSeasonId),
        eq(teamWeekLineups.teamId, input.teamId),
        eq(teamWeekLineups.week, input.week),
      ),
    );

  return rows.length > 0 ? rows : null;
}

/** Batch load snapshots for multiple teams in a week. */
export async function loadTeamWeekLineups(input: {
  leagueSeasonId: string;
  teamIds: string[];
  week: number;
}): Promise<Map<string, TeamWeekLineup[]>> {
  const map = new Map<string, TeamWeekLineup[]>();
  if (input.teamIds.length === 0) return map;

  const teamIdSet = new Set(input.teamIds);
  const rows = await db
    .select()
    .from(teamWeekLineups)
    .where(
      and(
        eq(teamWeekLineups.leagueSeasonId, input.leagueSeasonId),
        eq(teamWeekLineups.week, input.week),
      ),
    );

  for (const row of rows) {
    if (!teamIdSet.has(row.teamId)) continue;
    const list = map.get(row.teamId) ?? [];
    list.push(row);
    map.set(row.teamId, list);
  }

  return map;
}
