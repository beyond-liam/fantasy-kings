-- Per-user in-app notifications (bell dropdown).
CREATE TYPE "public"."notification_type" AS ENUM(
  'trade_offer',
  'trade_update',
  'waiver_processed',
  'player_status',
  'matchup_result'
);--> statement-breakpoint
CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "recipient_user_id" uuid NOT NULL,
  "league_season_id" uuid,
  "type" "notification_type" NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "href" text NOT NULL,
  "trade_id" uuid,
  "claim_id" uuid,
  "player_id" uuid,
  "matchup_id" uuid,
  "read_at" timestamp with time zone,
  "cleared_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_recipient_user_id_profiles_id_fk"
  FOREIGN KEY ("recipient_user_id") REFERENCES "public"."profiles"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_league_season_id_league_seasons_id_fk"
  FOREIGN KEY ("league_season_id") REFERENCES "public"."league_seasons"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_trade_id_trades_id_fk"
  FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id")
  ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_claim_id_waiver_claims_id_fk"
  FOREIGN KEY ("claim_id") REFERENCES "public"."waiver_claims"("id")
  ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_player_id_players_id_fk"
  FOREIGN KEY ("player_id") REFERENCES "public"."players"("id")
  ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_matchup_id_matchups_id_fk"
  FOREIGN KEY ("matchup_id") REFERENCES "public"."matchups"("id")
  ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_recipient_uncleared_idx"
  ON "notifications" USING btree ("recipient_user_id","cleared_at","created_at");
