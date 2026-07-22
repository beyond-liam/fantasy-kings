import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { leagueSeasons } from "./league-seasons";

export const divisions = pgTable("divisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  leagueSeasonId: uuid("league_season_id")
    .notNull()
    .references(() => leagueSeasons.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
});
