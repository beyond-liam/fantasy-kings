ALTER TYPE "public"."trade_status" ADD VALUE IF NOT EXISTS 'expired';--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trades_expires_pending_idx"
  ON "trades" USING btree ("expires_at")
  WHERE "status" = 'pending' AND "expires_at" IS NOT NULL;
