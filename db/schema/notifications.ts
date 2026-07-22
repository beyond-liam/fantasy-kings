import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { leagueSeasons } from "./league-seasons";
import { matchups } from "./matchups";
import { players } from "./players";
import { profiles } from "./users";
import { trades } from "./trades";
import { waiverClaims } from "./waiver-claims";

export const notificationTypeEnum = pgEnum("notification_type", [
  "trade_offer",
  "trade_update",
  "waiver_processed",
  "player_status",
  "matchup_result",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    leagueSeasonId: uuid("league_season_id").references(() => leagueSeasons.id, {
      onDelete: "cascade",
    }),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href").notNull(),
    tradeId: uuid("trade_id").references(() => trades.id, {
      onDelete: "set null",
    }),
    claimId: uuid("claim_id").references(() => waiverClaims.id, {
      onDelete: "set null",
    }),
    playerId: uuid("player_id").references(() => players.id, {
      onDelete: "set null",
    }),
    matchupId: uuid("matchup_id").references(() => matchups.id, {
      onDelete: "set null",
    }),
    readAt: timestamp("read_at", { withTimezone: true }),
    clearedAt: timestamp("cleared_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("notifications_recipient_uncleared_idx").on(
      table.recipientUserId,
      table.clearedAt,
      table.createdAt,
    ),
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
