import {
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { leagueSeasons } from "./league-seasons";
import { teams } from "./teams";

export const matchupStatusEnum = pgEnum("matchup_status", [
  "scheduled",
  "in_progress",
  "final",
]);

/**
 * Head-to-head fantasy matchup for a league season week.
 * Regular-season games only for now (playoffs deferred).
 * Live points still come from player_scores; home/away pts lock when status=final.
 * `publicId` is the short URL segment under `/league/.../scores/[matchupId]`.
 */
export const matchups = pgTable(
  "matchups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueSeasonId: uuid("league_season_id")
      .notNull()
      .references(() => leagueSeasons.id, { onDelete: "cascade" }),
    /** 6-char public id for URLs; unique within the season. */
    publicId: text("public_id"),
    week: integer("week").notNull(),
    homeTeamId: uuid("home_team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    awayTeamId: uuid("away_team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    homePts: doublePrecision("home_pts"),
    awayPts: doublePrecision("away_pts"),
    status: matchupStatusEnum("status").notNull().default("scheduled"),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("matchups_season_week_home_away_idx").on(
      table.leagueSeasonId,
      table.week,
      table.homeTeamId,
      table.awayTeamId,
    ),
    uniqueIndex("matchups_season_public_id_idx").on(
      table.leagueSeasonId,
      table.publicId,
    ),
  ],
);
