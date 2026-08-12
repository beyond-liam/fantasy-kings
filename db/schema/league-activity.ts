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
  /** Competing claims when this waiver award was processed. */
  claimCount?: number | null;
  claimResolution?: Array<{
    teamId: string;
    teamName: string;
    bid: number | null;
    waiverPriority: number;
    status: "won" | "lost" | "illegal_roster";
    failReason?: string | null;
  }> | null;
  tradeId?: string | null;
  proposingTeamName?: string | null;
  receivingTeamName?: string | null;
  removalReason?: string | null;
  removedUserId?: string | null;
  removedDisplayName?: string | null;
  settingsSection?: string;
  settingsLabel?: string;
  settingsChanges?: Array<{
    path: string;
    label: string;
    before: string;
    after: string;
  }>;
  matchupId?: string;
  matchupPublicId?: string | null;
  week?: number;
  homeTeamName?: string;
  awayTeamName?: string;
  homePtsBefore?: number;
  awayPtsBefore?: number;
  homePtsAfter?: number;
  awayPtsAfter?: number;
  overall?: number;
  round?: number;
  pickInRound?: number;
  draftSource?: "manual" | "commissioner" | "autopick";
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
    index("league_activity_team_id_idx").on(table.teamId),
    index("league_activity_actor_user_id_idx").on(table.actorUserId),
    index("league_activity_player_id_idx").on(table.playerId),
    index("league_activity_claim_id_idx").on(table.claimId),
    index("league_activity_trade_id_idx").on(table.tradeId),
  ],
);
