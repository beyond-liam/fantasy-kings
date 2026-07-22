import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { players } from "./players";
import { teams } from "./teams";

export const rosterPlayerStatusEnum = pgEnum("roster_player_status", [
  "rostered",
  "waived",
]);

/** Players currently on a fantasy team roster, or temporarily on waivers after a cut.
 *
 * Write invariants (enforced in app code until a season-scoped partial unique index exists):
 * - At most one `rostered` row per player per league season across all teams.
 * - Waive/cut should update the existing row to `waived` (or clear expired waived) rather than
 *   inserting a duplicate `(team_id, player_id)` when reclaiming a free agent.
 */
export const rosterPlayers = pgTable(
  "roster_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
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
  ],
);
