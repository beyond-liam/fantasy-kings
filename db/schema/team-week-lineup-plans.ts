import { index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { leagueSeasons } from './league-seasons'
import { players } from './players'
import { positions } from './positions'
import { teams } from './teams'

/**
 * Scheduled slot assignments for a future fantasy week.
 * Applied onto the live roster when that week becomes current.
 */
export const teamWeekLineupPlans = pgTable(
  'team_week_lineup_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leagueSeasonId: uuid('league_season_id')
      .notNull()
      .references(() => leagueSeasons.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    week: integer('week').notNull(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    slotPositionId: text('slot_position_id').references(() => positions.id, {
      onDelete: 'set null',
    }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('team_week_lineup_plans_season_team_week_player_uniq').on(
      table.leagueSeasonId,
      table.teamId,
      table.week,
      table.playerId
    ),
    index('team_week_lineup_plans_season_team_week_idx').on(
      table.leagueSeasonId,
      table.teamId,
      table.week
    ),
  ]
)

export type TeamWeekLineupPlan = typeof teamWeekLineupPlans.$inferSelect
export type NewTeamWeekLineupPlan = typeof teamWeekLineupPlans.$inferInsert
