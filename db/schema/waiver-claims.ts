import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { waiverClaimStatusEnum } from "./league-enums";
import { leagueSeasons } from "./league-seasons";
import { players } from "./players";
import { teams } from "./teams";

export const waiverClaims = pgTable(
  "waiver_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueSeasonId: uuid("league_season_id")
      .notNull()
      .references(() => leagueSeasons.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    /** Optional simultaneous drop if roster space is needed. */
    dropPlayerId: uuid("drop_player_id").references(() => players.id, {
      onDelete: "set null",
    }),
    /** FAAB bid; null for priority leagues. */
    bid: integer("bid"),
    /** Lower = higher preference when processing this team's claim queue. */
    sortOrder: integer("sort_order").notNull().default(0),
    status: waiverClaimStatusEnum("status").notNull().default("pending"),
    failReason: text("fail_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("waiver_claims_pending_team_player_idx")
      .on(table.teamId, table.playerId)
      .where(sql`${table.status} = 'pending'`),
    index("waiver_claims_season_pending_idx")
      .on(table.leagueSeasonId, table.sortOrder, table.createdAt)
      .where(sql`${table.status} = 'pending'`),
    index("waiver_claims_team_status_idx").on(table.teamId, table.status),
  ],
);
