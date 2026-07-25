import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { leagueSeasons } from "./league-seasons";
import { teams } from "./teams";
import { profiles } from "./users";

/**
 * League bulletin-board thread. Body lives on `message_posts` (first post = OP).
 * `publicId` is the URL segment under `/league/.../messages/[threadId]`.
 */
export const messageThreads = pgTable(
  "message_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueSeasonId: uuid("league_season_id")
      .notNull()
      .references(() => leagueSeasons.id, { onDelete: "cascade" }),
    publicId: text("public_id").notNull(),
    title: text("title").notNull(),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    authorTeamId: uuid("author_team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
    /** Reply posts only (excludes the opening post). */
    replyCount: integer("reply_count").notNull().default(0),
    lastPostAt: timestamp("last_post_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("message_threads_season_public_id_idx").on(
      table.leagueSeasonId,
      table.publicId,
    ),
    index("message_threads_season_last_post_idx").on(
      table.leagueSeasonId,
      table.lastPostAt,
    ),
  ],
);

export const messagePosts = pgTable(
  "message_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => messageThreads.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    authorTeamId: uuid("author_team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("message_posts_thread_created_idx").on(
      table.threadId,
      table.createdAt,
    ),
  ],
);

/** Per-user last-read cursor for a thread (unread = lastPostAt > lastReadAt). */
export const messageThreadReads = pgTable(
  "message_thread_reads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => messageThreads.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("message_thread_reads_user_thread_idx").on(
      table.userId,
      table.threadId,
    ),
  ],
);

export type MessageThread = typeof messageThreads.$inferSelect;
export type MessagePost = typeof messagePosts.$inferSelect;
