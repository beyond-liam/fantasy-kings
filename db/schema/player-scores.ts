import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { players } from "./players";

export const playerScoreKindEnum = pgEnum("player_score_kind", [
  "projection",
  "stats",
]);

export const playerScores = pgTable(
  "player_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    season: text("season").notNull(),
    week: integer("week").notNull(),
    seasonType: text("season_type").notNull().default("regular"),
    kind: playerScoreKindEnum("kind").notNull(),
    stats: jsonb("stats").notNull().default({}),
    ptsPpr: doublePrecision("pts_ppr"),
    ptsStd: doublePrecision("pts_std"),
    gp: doublePrecision("gp"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("player_scores_unique_idx").on(
      table.playerId,
      table.season,
      table.week,
      table.seasonType,
      table.kind,
    ),
    index("player_scores_season_week_kind_idx").on(
      table.season,
      table.week,
      table.seasonType,
      table.kind,
    ),
  ],
);
