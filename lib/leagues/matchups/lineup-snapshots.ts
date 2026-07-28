import { eq, and } from 'drizzle-orm'
import type { TeamWeekLineup, NewTeamWeekLineup } from '@/db/schema'
import { teamWeekLineups } from '@/db/schema'
import { db } from '@/lib/db'

/**
 * Upsert frozen lineup for a team-week. Insert only if no rows exist;
 * never overwrites existing snapshots (idempotent finalize).
 */
export async function upsertTeamWeekLineup(
  dbConn: typeof db,
  { leagueSeasonId, teamId, week, starters }: {
    leagueSeasonId: string
    teamId: string
    week: number
    starters: Array<{ playerId: string; slotPositionId?: string | null }>
  }
): Promise<void> {
  // Check if any snapshots exist for this team-week
  const existing = await dbConn
    .select({ id: teamWeekLineups.id })
    .from(teamWeekLineups)
    .where(
      and(
        eq(teamWeekLineups.leagueSeasonId, leagueSeasonId),
        eq(teamWeekLineups.teamId, teamId),
        eq(teamWeekLineups.week, week)
      )
    )
    .limit(1)

  if (existing.length > 0) {
    // Already snapshotted; do not overwrite
    return
  }

  // Insert all starters for this team-week
  const rows: NewTeamWeekLineup[] = starters.map((s) => ({
    leagueSeasonId,
    teamId,
    week,
    playerId: s.playerId,
    slotPositionId: s.slotPositionId ?? null,
  }))

  if (rows.length > 0) {
    await dbConn.insert(teamWeekLineups).values(rows)
  }
}

/**
 * Load frozen lineup for a single team-week.
 */
export async function loadTeamWeekLineup(
  dbConn: typeof db,
  { leagueSeasonId, teamId, week }: {
    leagueSeasonId: string
    teamId: string
    week: number
  }
): Promise<TeamWeekLineup[]> {
  return await dbConn
    .select()
    .from(teamWeekLineups)
    .where(
      and(
        eq(teamWeekLineups.leagueSeasonId, leagueSeasonId),
        eq(teamWeekLineups.teamId, teamId),
        eq(teamWeekLineups.week, week)
      )
    )
}

/**
 * Load frozen lineups for multiple teams in a given week.
 * Returns a map of teamId → array of lineup rows.
 */
export async function loadTeamWeekLineups(
  dbConn: typeof db,
  { leagueSeasonId, teamIds, week }: {
    leagueSeasonId: string
    teamIds: string[]
    week: number
  }
): Promise<Map<string, TeamWeekLineup[]>> {
  if (teamIds.length === 0) {
    return new Map()
  }

  const rows = await dbConn
    .select()
    .from(teamWeekLineups)
    .where(
      and(
        eq(teamWeekLineups.leagueSeasonId, leagueSeasonId),
        eq(teamWeekLineups.week, week)
      )
    )

  // Group by teamId
  const byTeam = new Map<string, TeamWeekLineup[]>()
  for (const row of rows) {
    if (teamIds.includes(row.teamId)) {
      const arr = byTeam.get(row.teamId) ?? []
      arr.push(row)
      byTeam.set(row.teamId, arr)
    }
  }

  return byTeam
}
