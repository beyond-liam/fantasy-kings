import { boolean, integer, pgEnum, pgTable, text } from "drizzle-orm/pg-core";

export const positionSideEnum = pgEnum("position_side", [
  "offense",
  "defense",
  "special",
  "flex",
]);

export const positions = pgTable("positions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  side: positionSideEnum("side").notNull(),
  sortOrder: integer("sort_order").notNull(),
  isStarterSlot: boolean("is_starter_slot").notNull().default(true),
});
