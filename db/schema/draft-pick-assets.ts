import {
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { leagues } from "./leagues";
import { teams } from "./teams";

/**
 * Dynasty future-pick inventory. Slot/overall stay null until the prior
 * season's finish locks the original team's draft position.
 */
export const draftPickAssets = pgTable(
  "draft_pick_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    draftYear: integer("draft_year").notNull(),
    round: integer("round").notNull(),
    /** Franchise that originally owned this pick (finish resolves the slot). */
    originalTeamId: uuid("original_team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    /** Current holder. */
    ownerTeamId: uuid("owner_team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    slot: integer("slot"),
    overall: integer("overall"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("draft_pick_assets_league_year_round_original_uidx").on(
      table.leagueId,
      table.draftYear,
      table.round,
      table.originalTeamId,
    ),
    index("draft_pick_assets_owner_team_id_idx").on(table.ownerTeamId),
    index("draft_pick_assets_original_team_id_idx").on(table.originalTeamId),
  ],
);
