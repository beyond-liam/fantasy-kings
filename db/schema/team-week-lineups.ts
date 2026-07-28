import { index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { leagueSeasons } from './league-seasons'
import { players } from './players'
import { positions } from './positions'
import { teams } from './teams'

/**
 * Frozen lineup snapshot captured at finalize.
 * Official score corrections re-score these frozen starters
 * instead of rewriting history from live roster.
 */
export const teamWeekLineups = pgTable(
  'team_week_lineups',
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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('team_week_lineups_season_team_week_player_uniq').on(
      table.leagueSeasonId,
      table.teamId,
      table.week,
      table.playerId
    ),
    index('team_week_lineups_season_team_week_idx').on(
      table.leagueSeasonId,
      table.teamId,
      table.week
    ),
    index('team_week_lineups_player_id_idx').on(table.playerId),
  ]
)

export type TeamWeekLineup = typeof teamWeekLineups.$inferSelect
export type NewTeamWeekLineup = typeof teamWeekLineups.$inferInsert
