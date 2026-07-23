-- Hot-path indexes, roster season uniqueness, and Data API lockdown (RLS).
-- Runtime app continues to use the table-owner / service connection (bypasses RLS).

-- 1) Roster: denormalize league_season_id + partial unique (one rostered player / season)
ALTER TABLE "roster_players" ADD COLUMN IF NOT EXISTS "league_season_id" uuid;--> statement-breakpoint

UPDATE "roster_players" AS rp
SET "league_season_id" = t."league_season_id"
FROM "teams" AS t
WHERE t."id" = rp."team_id"
  AND rp."league_season_id" IS NULL;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "roster_players" AS rp
    JOIN "teams" AS t ON t."id" = rp."team_id"
    WHERE rp."status" = 'rostered'
    GROUP BY COALESCE(rp."league_season_id", t."league_season_id"), rp."player_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add roster_players season unique: duplicate rostered players exist for a league season';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "roster_players" WHERE "league_season_id" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot harden roster_players.league_season_id: orphan rows with no team season';
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "roster_players" ALTER COLUMN "league_season_id" SET NOT NULL;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roster_players_league_season_id_league_seasons_id_fk'
  ) THEN
    ALTER TABLE "roster_players"
      ADD CONSTRAINT "roster_players_league_season_id_league_seasons_id_fk"
      FOREIGN KEY ("league_season_id") REFERENCES "public"."league_seasons"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "roster_players_season_player_rostered_uidx"
  ON "roster_players" USING btree ("league_season_id","player_id")
  WHERE "status" = 'rostered';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roster_players_player_status_idx"
  ON "roster_players" USING btree ("player_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roster_players_season_id_idx"
  ON "roster_players" USING btree ("league_season_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roster_players_waiver_clear_idx"
  ON "roster_players" USING btree ("waiver_clears_at")
  WHERE "status" = 'waived' AND "waiver_clears_at" IS NOT NULL;--> statement-breakpoint

-- 2) Trades
CREATE INDEX IF NOT EXISTS "trades_season_created_idx"
  ON "trades" USING btree ("league_season_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trades_proposing_team_idx"
  ON "trades" USING btree ("proposing_team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trades_receiving_team_idx"
  ON "trades" USING btree ("receiving_team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trades_review_due_idx"
  ON "trades" USING btree ("review_ends_at")
  WHERE "status" = 'review';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trades_season_awaiting_commish_idx"
  ON "trades" USING btree ("league_season_id")
  WHERE "status" = 'awaiting_commissioner';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trades_receiving_pending_idx"
  ON "trades" USING btree ("receiving_team_id")
  WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trade_players_team_id_idx"
  ON "trade_players" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trade_players_player_id_idx"
  ON "trade_players" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trade_vetoes_user_id_idx"
  ON "trade_vetoes" USING btree ("user_id");--> statement-breakpoint

-- 3) Waivers
CREATE INDEX IF NOT EXISTS "waiver_claims_season_pending_idx"
  ON "waiver_claims" USING btree ("league_season_id","sort_order","created_at")
  WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waiver_claims_team_status_idx"
  ON "waiver_claims" USING btree ("team_id","status");--> statement-breakpoint

-- 4) Activity + members + divisions
CREATE INDEX IF NOT EXISTS "league_activity_season_created_idx"
  ON "league_activity" USING btree ("league_season_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "league_activity_season_type_created_idx"
  ON "league_activity" USING btree ("league_season_id","type","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "league_members_user_id_idx"
  ON "league_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "divisions_league_season_id_idx"
  ON "divisions" USING btree ("league_season_id");--> statement-breakpoint

-- 5) RLS: deny PostgREST anon/authenticated by default (no policies).
-- Table owner / postgres role used by Drizzle still bypasses RLS (not FORCE).
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leagues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "league_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "league_seasons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "divisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_watchlist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "roster_players" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "waiver_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trades" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trade_players" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trade_vetoes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "league_activity" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "draft_picks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "draft_queue" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "players" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "player_external_ids" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "player_scores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "positions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "matchups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_sends" ENABLE ROW LEVEL SECURITY;
