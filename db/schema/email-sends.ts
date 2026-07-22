import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Idempotency log for transactional emails (cron retries, double-submit, poll).
 * `dedupeKey` examples: `draft:start:{draftId}`, `draft:on_clock:{draftId}:{pickIndex}`
 */
export const emailSends = pgTable(
  "email_sends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("email_sends_dedupe_key_uidx").on(table.dedupeKey)],
);
