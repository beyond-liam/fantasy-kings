import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** App profile — id matches Supabase auth.users.id */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    /** Public handle (@username). */
    username: text("username"),
    /** Denormalized person label (first + last); prefer formatPersonName at read time. */
    displayName: text("display_name"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    /** Favourite NFL team abbreviation (e.g. BUF). */
    favouriteNflTeam: text("favourite_nfl_team"),
    avatarUrl: text("avatar_url"),
    /** Include ESPN preseason weeks in NFL Scores. */
    includePreseason: boolean("include_preseason").default(true).notNull(),
    /** First preseason week to show when includePreseason is on (1–4). */
    preseasonStartWeek: integer("preseason_start_week").default(1).notNull(),
    /** Null until first-login onboarding completes. */
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    /** Most recent authenticated app heartbeat, using server time. */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("profiles_username_unique_idx").on(table.username)],
);
