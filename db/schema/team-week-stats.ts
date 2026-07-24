import {
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { leagueSeasons } from "./league-seasons";
import { teams } from "./teams";

/**
 * Per-team weekly scoring snapshot for league stats rollups (PF / OPF /
 * position points). Upserted when weekly actuals are available.
 */
export const teamWeekStats = pgTable(
  "team_week_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueSeasonId: uuid("league_season_id")
      .notNull()
      .references(() => leagueSeasons.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    week: integer("week").notNull(),
    pointsFor: doublePrecision("points_for"),
    optimumPointsFor: doublePrecision("optimum_points_for"),
    /** Starter points by slot position id. */
    byPosition: jsonb("by_position")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("team_week_stats_season_team_week_idx").on(
      table.leagueSeasonId,
      table.teamId,
      table.week,
    ),
  ],
);
