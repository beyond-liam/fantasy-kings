import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { divisions } from "./divisions";
import { leagueSeasons } from "./league-seasons";
import { profiles } from "./users";

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueSeasonId: uuid("league_season_id")
      .notNull()
      .references(() => leagueSeasons.id, { onDelete: "cascade" }),
    /**
     * Stable franchise id across seasons. Copied when starting a new season
     * so future picks can follow the same team.
     */
    lineageId: uuid("lineage_id").notNull().defaultRandom(),
    /** Null until a manager claims this slot. */
    userId: uuid("user_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    /** Public image URL for the team logo. */
    logoUrl: text("logo_url"),
    /** Stable short id used in `/league/{leagueId}/team/{teamId}` URLs. */
    publicId: text("public_id"),
    /** Legacy name-derived key; kept unique per season but not used in routes. */
    slug: text("slug"),
    divisionId: uuid("division_id").references(() => divisions.id, {
      onDelete: "set null",
    }),
    draftSlot: integer("draft_slot"),
    /** When true, autopick runs for this team when on the clock. */
    autoPickEnabled: boolean("auto_pick_enabled").notNull().default(false),
    /** Consecutive clock-expiry autodrafts for this team; reset on a non-miss pick. */
    consecutiveExpiredPicks: integer("consecutive_expired_picks")
      .notNull()
      .default(0),
    /**
     * Commissioner setting: this team skips the pick clock and autodrafts
     * until the owner comes back online.
     */
    forcedAutoPick: boolean("forced_auto_pick").notNull().default(false),
    /** Lower number = higher priority (1 processes first). */
    waiverPriority: integer("waiver_priority").notNull().default(1),
    /** Remaining FAAB; null when league uses priority waivers. */
    faabRemaining: integer("faab_remaining"),
    /** Last time this manager dismissed the post-process waiver results dialog. */
    lastWaiverResultsSeenAt: timestamp("last_waiver_results_seen_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("teams_season_user_idx")
      .on(table.leagueSeasonId, table.userId)
      .where(sql`${table.userId} is not null`),
    uniqueIndex("teams_season_slug_idx").on(table.leagueSeasonId, table.slug),
    uniqueIndex("teams_season_public_id_idx").on(
      table.leagueSeasonId,
      table.publicId,
    ),
    uniqueIndex("teams_season_lineage_idx").on(
      table.leagueSeasonId,
      table.lineageId,
    ),
  ],
);
