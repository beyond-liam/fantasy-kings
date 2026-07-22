import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { tradeStatusEnum } from "./league-enums";
import { leagueSeasons } from "./league-seasons";
import { players } from "./players";
import { teams } from "./teams";
import { profiles } from "./users";

export const trades = pgTable("trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  leagueSeasonId: uuid("league_season_id")
    .notNull()
    .references(() => leagueSeasons.id, { onDelete: "cascade" }),
  proposingTeamId: uuid("proposing_team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  receivingTeamId: uuid("receiving_team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  status: tradeStatusEnum("status").notNull().default("pending"),
  comment: text("comment"),
  /** When review_24h processing applies — trade auto-completes after this time. */
  reviewEndsAt: timestamp("review_ends_at", { withTimezone: true }),
  counterpartyAcceptedAt: timestamp("counterparty_accepted_at", {
    withTimezone: true,
  }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdByUserId: uuid("created_by_user_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const tradePlayers = pgTable(
  "trade_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tradeId: uuid("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    /** Dropped to make roster room — not sent to the other team. */
    isDrop: boolean("is_drop").notNull().default(false),
  },
  (table) => [
    uniqueIndex("trade_players_trade_team_player_idx").on(
      table.tradeId,
      table.teamId,
      table.playerId,
    ),
  ],
);

export const tradeVetoes = pgTable(
  "trade_vetoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tradeId: uuid("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("trade_vetoes_trade_team_idx").on(table.tradeId, table.teamId),
  ],
);
