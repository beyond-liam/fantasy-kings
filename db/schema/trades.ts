import { sql } from "drizzle-orm";
import {
  boolean,
  index,
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

export const trades = pgTable(
  "trades",
  {
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
  },
  (table) => [
    index("trades_season_created_idx").on(
      table.leagueSeasonId,
      table.createdAt,
    ),
    index("trades_proposing_team_idx").on(table.proposingTeamId),
    index("trades_receiving_team_idx").on(table.receivingTeamId),
    index("trades_review_due_idx")
      .on(table.reviewEndsAt)
      .where(sql`${table.status} = 'review'`),
    index("trades_season_awaiting_commish_idx")
      .on(table.leagueSeasonId)
      .where(sql`${table.status} = 'awaiting_commissioner'`),
    index("trades_receiving_pending_idx")
      .on(table.receivingTeamId)
      .where(sql`${table.status} = 'pending'`),
  ],
);

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
    index("trade_players_team_id_idx").on(table.teamId),
    index("trade_players_player_id_idx").on(table.playerId),
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
    index("trade_vetoes_user_id_idx").on(table.userId),
  ],
);
