import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { leagueActivityTypeEnum } from "./league-enums";
import { leagueSeasons } from "./league-seasons";
import { players } from "./players";
import { teams } from "./teams";
import { profiles } from "./users";
import { trades } from "./trades";
import { waiverClaims } from "./waiver-claims";

export type LeagueActivityMetadata = {
  bid?: number | null;
  failReason?: string | null;
  playerName?: string;
  dropPlayerName?: string | null;
  teamName?: string;
  waiverType?: "priority" | "faab";
  tradeId?: string | null;
  proposingTeamName?: string | null;
  receivingTeamName?: string | null;
  removalReason?: string | null;
  removedUserId?: string | null;
  removedDisplayName?: string | null;
};

export const leagueActivity = pgTable(
  "league_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueSeasonId: uuid("league_season_id")
      .notNull()
      .references(() => leagueSeasons.id, { onDelete: "cascade" }),
    type: leagueActivityTypeEnum("type").notNull(),
    teamId: uuid("team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
    actorUserId: uuid("actor_user_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    playerId: uuid("player_id").references(() => players.id, {
      onDelete: "set null",
    }),
    /** e.g. dropped player on a waiver award. */
    relatedPlayerId: uuid("related_player_id").references(() => players.id, {
      onDelete: "set null",
    }),
    claimId: uuid("claim_id").references(() => waiverClaims.id, {
      onDelete: "set null",
    }),
    tradeId: uuid("trade_id").references(() => trades.id, {
      onDelete: "set null",
    }),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata").$type<LeagueActivityMetadata>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("league_activity_season_created_idx").on(
      table.leagueSeasonId,
      table.createdAt,
    ),
    index("league_activity_season_type_created_idx").on(
      table.leagueSeasonId,
      table.type,
      table.createdAt,
    ),
  ],
);
