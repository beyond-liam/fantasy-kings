import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./users";

export const memberRoleEnum = pgEnum("member_role", [
  "commissioner",
  "co_commissioner",
  "member",
]);

export const leagues = pgTable("leagues", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Stable short id used in `/league/{publicId}` URLs. */
  publicId: text("public_id").notNull().unique(),
  /** Legacy name-derived key; kept unique but not used in routes. */
  slug: text("slug").notNull().unique(),
  inviteCode: text("invite_code").notNull().unique(),
  commissionerId: uuid("commissioner_id")
    .notNull()
    .references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const leagueMembers = pgTable(
  "league_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("league_members_league_user_idx").on(
      table.leagueId,
      table.userId,
    ),
  ],
);
