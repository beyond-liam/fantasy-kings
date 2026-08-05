import {
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { drafts } from "./drafts";
import { players } from "./players";
import { teams } from "./teams";

export const draftGradeLetterEnum = pgEnum("draft_grade_letter", [
  "A+",
  "A",
  "B+",
  "B",
  "C+",
  "C",
  "D",
  "F",
]);

/** Frozen per-team draft grade snapshot. `seenAt` gates the one-time popup. */
export const draftGrades = pgTable(
  "draft_grades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => drafts.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    letter: draftGradeLetterEnum("letter").notNull(),
    /** 0–100 composite used to rank within the league. */
    score: real("score").notNull(),
    leagueRank: integer("league_rank").notNull(),
    teamCount: integer("team_count").notNull(),
    projectedWins: integer("projected_wins").notNull(),
    projectedLosses: integer("projected_losses").notNull(),
    /** 0–100 */
    playoffOdds: real("playoff_odds").notNull(),
    /** 0–100 */
    championshipOdds: real("championship_odds").notNull(),
    bestValuePlayerId: uuid("best_value_player_id").references(
      () => players.id,
      { onDelete: "set null" },
    ),
    bestValueOverall: integer("best_value_overall"),
    bestValueRound: integer("best_value_round"),
    bestValuePickInRound: integer("best_value_pick_in_round"),
    bestValueAdp: doublePrecision("best_value_adp"),
    worstValuePlayerId: uuid("worst_value_player_id").references(
      () => players.id,
      { onDelete: "set null" },
    ),
    worstValueOverall: integer("worst_value_overall"),
    worstValueRound: integer("worst_value_round"),
    worstValuePickInRound: integer("worst_value_pick_in_round"),
    worstValueAdp: doublePrecision("worst_value_adp"),
    /** Short blurb for the grade (optional). */
    headline: text("headline"),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("draft_grades_draft_team_idx").on(table.draftId, table.teamId),
    index("draft_grades_team_id_idx").on(table.teamId),
  ],
);
