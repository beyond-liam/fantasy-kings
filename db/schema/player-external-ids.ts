import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { players } from "./players";

export const playerExternalIdProviderEnum = pgEnum(
  "player_external_id_provider",
  ["sleeper"],
);

export const playerExternalIds = pgTable(
  "player_external_ids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    provider: playerExternalIdProviderEnum("provider").notNull(),
    externalId: text("external_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("player_external_ids_provider_external_id_idx").on(
      table.provider,
      table.externalId,
    ),
  ],
);
