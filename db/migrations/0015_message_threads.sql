CREATE TABLE "message_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "league_season_id" uuid NOT NULL,
  "public_id" text NOT NULL,
  "title" text NOT NULL,
  "author_user_id" uuid NOT NULL,
  "author_team_id" uuid,
  "reply_count" integer DEFAULT 0 NOT NULL,
  "last_post_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "message_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL,
  "author_user_id" uuid NOT NULL,
  "author_team_id" uuid,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "message_thread_reads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "last_read_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "message_threads"
  ADD CONSTRAINT "message_threads_league_season_id_league_seasons_id_fk"
  FOREIGN KEY ("league_season_id") REFERENCES "public"."league_seasons"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads"
  ADD CONSTRAINT "message_threads_author_user_id_profiles_id_fk"
  FOREIGN KEY ("author_user_id") REFERENCES "public"."profiles"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads"
  ADD CONSTRAINT "message_threads_author_team_id_teams_id_fk"
  FOREIGN KEY ("author_team_id") REFERENCES "public"."teams"("id")
  ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_posts"
  ADD CONSTRAINT "message_posts_thread_id_message_threads_id_fk"
  FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_posts"
  ADD CONSTRAINT "message_posts_author_user_id_profiles_id_fk"
  FOREIGN KEY ("author_user_id") REFERENCES "public"."profiles"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_posts"
  ADD CONSTRAINT "message_posts_author_team_id_teams_id_fk"
  FOREIGN KEY ("author_team_id") REFERENCES "public"."teams"("id")
  ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_thread_reads"
  ADD CONSTRAINT "message_thread_reads_thread_id_message_threads_id_fk"
  FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_thread_reads"
  ADD CONSTRAINT "message_thread_reads_user_id_profiles_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "message_threads_season_public_id_idx"
  ON "message_threads" ("league_season_id", "public_id");--> statement-breakpoint
CREATE INDEX "message_threads_season_last_post_idx"
  ON "message_threads" ("league_season_id", "last_post_at");--> statement-breakpoint
CREATE INDEX "message_posts_thread_created_idx"
  ON "message_posts" ("thread_id", "created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "message_thread_reads_user_thread_idx"
  ON "message_thread_reads" ("user_id", "thread_id");
