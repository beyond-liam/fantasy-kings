import {
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { leagueSeasons } from "./league-seasons";
import { players } from "./players";
import { teams } from "./teams";

export const draftStatusEnum = pgEnum("draft_status", [
  "scheduled",
  "live",
  "paused",
  "complete",
]);

export const draftPickSourceEnum = pgEnum("draft_pick_source", [
  "manual",
  "commissioner",
  "autopick",
]);

/** One draft per league season. */
export const drafts = pgTable(
  "drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueSeasonId: uuid("league_season_id")
      .notNull()
      .references(() => leagueSeasons.id, { onDelete: "cascade" }),
    status: draftStatusEnum("status").notNull().default("scheduled"),
    /** 0-based index into the generated pick schedule (= number of made picks). */
    currentPickIndex: integer("current_pick_index").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    /**
     * Absolute deadline for the current pick clock while live.
     * Null when unlimited, paused, or draft not live.
     */
    turnExpiresAt: timestamp("turn_expires_at", { withTimezone: true }),
    /** Remaining pick-clock seconds frozen while status is paused. */
    pausedSecondsRemaining: integer("paused_seconds_remaining"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("drafts_season_idx").on(table.leagueSeasonId),
  ],
);

/** Completed picks only — empty board cells are generated on read. */
export const draftPicks = pgTable(
  "draft_picks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => drafts.id, { onDelete: "cascade" }),
    overall: integer("overall").notNull(),
    round: integer("round").notNull(),
    pickInRound: integer("pick_in_round").notNull(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    source: draftPickSourceEnum("source").notNull().default("manual"),
    madeAt: timestamp("made_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    madeByUserId: uuid("made_by_user_id"),
  },
  (table) => [
    uniqueIndex("draft_picks_draft_overall_idx").on(table.draftId, table.overall),
    uniqueIndex("draft_picks_draft_player_idx").on(table.draftId, table.playerId),
  ],
);

/** Per-team draft queue (ordered wishlist). */
export const draftQueue = pgTable(
  "draft_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("draft_queue_team_player_idx").on(table.teamId, table.playerId),
  ],
);
