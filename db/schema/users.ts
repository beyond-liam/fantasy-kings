import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/** App profile — id matches Supabase auth.users.id */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    /** Public handle shown in leagues; kept in sync with displayName. */
    username: text("username"),
    displayName: text("display_name"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    /** Favourite NFL team abbreviation (e.g. BUF). */
    favouriteNflTeam: text("favourite_nfl_team"),
    avatarUrl: text("avatar_url"),
    /** Null until first-login onboarding completes. */
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("profiles_username_unique_idx").on(table.username)],
);
