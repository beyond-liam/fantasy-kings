import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { positions } from "./positions";

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  nflTeam: text("nfl_team"),
  primaryPositionId: text("primary_position_id")
    .notNull()
    .references(() => positions.id),
  sleeperSearchRank: integer("sleeper_search_rank"),
  yearsExp: integer("years_exp"),
  byeWeek: integer("bye_week"),
  injuryStatus: text("injury_status"),
  rookieYear: text("rookie_year"),
  age: integer("age"),
  height: text("height"),
  weight: text("weight"),
  college: text("college"),
  jerseyNumber: integer("jersey_number"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
