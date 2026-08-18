CREATE TABLE IF NOT EXISTS "trade_picks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trade_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "draft_pick_asset_id" uuid NOT NULL
);--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trade_picks_trade_id_trades_id_fk'
  ) THEN
    ALTER TABLE "trade_picks"
      ADD CONSTRAINT "trade_picks_trade_id_trades_id_fk"
      FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trade_picks_team_id_teams_id_fk'
  ) THEN
    ALTER TABLE "trade_picks"
      ADD CONSTRAINT "trade_picks_team_id_teams_id_fk"
      FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trade_picks_draft_pick_asset_id_draft_pick_assets_id_fk'
  ) THEN
    ALTER TABLE "trade_picks"
      ADD CONSTRAINT "trade_picks_draft_pick_asset_id_draft_pick_assets_id_fk"
      FOREIGN KEY ("draft_pick_asset_id") REFERENCES "public"."draft_pick_assets"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "trade_picks_trade_asset_idx"
  ON "trade_picks" USING btree ("trade_id", "draft_pick_asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trade_picks_team_id_idx"
  ON "trade_picks" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trade_picks_asset_id_idx"
  ON "trade_picks" USING btree ("draft_pick_asset_id");--> statement-breakpoint
ALTER TABLE "trade_picks" ENABLE ROW LEVEL SECURITY;
