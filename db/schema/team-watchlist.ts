import { pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { players } from "./players";
import { teams } from "./teams";

export const teamWatchlist = pgTable(
  "team_watchlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("team_watchlist_team_player_idx").on(
      table.teamId,
      table.playerId,
    ),
  ],
);
