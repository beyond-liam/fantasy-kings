import { sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { leagueSeasons } from "./league-seasons";
import { players } from "./players";
import { teams } from "./teams";

export const rosterPlayerStatusEnum = pgEnum("roster_player_status", [
  "rostered",
  "waived",
]);

/** Players currently on a fantasy team roster, or temporarily on waivers after a cut.
 *
 * DB enforces at most one `rostered` row per player per league season
 * (`roster_players_season_player_rostered_uidx`).
 */
export const rosterPlayers = pgTable(
  "roster_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueSeasonId: uuid("league_season_id")
      .notNull()
      .references(() => leagueSeasons.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    status: rosterPlayerStatusEnum("status").notNull().default("rostered"),
    /**
     * Lineup / bench assignment: QB, RB, WR, TE, FLEX, K, DEF, BN, IR, TAXI.
     * Null = unassigned (auto-placed into an eligible empty shell).
     */
    slotPositionId: text("slot_position_id"),
    /** When status is waived, player becomes a free agent after this time. */
    waiverClearsAt: timestamp("waiver_clears_at", { withTimezone: true }),
    /** When the player most recently became rostered on this team. */
    acquiredAt: timestamp("acquired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("roster_players_team_player_idx").on(
      table.teamId,
      table.playerId,
    ),
    uniqueIndex("roster_players_season_player_rostered_uidx")
      .on(table.leagueSeasonId, table.playerId)
      .where(sql`${table.status} = 'rostered'`),
    index("roster_players_player_status_idx").on(table.playerId, table.status),
    index("roster_players_season_id_idx").on(table.leagueSeasonId),
    index("roster_players_waiver_clear_idx")
      .on(table.waiverClearsAt)
      .where(
        sql`${table.status} = 'waived' AND ${table.waiverClearsAt} IS NOT NULL`,
      ),
  ],
);
