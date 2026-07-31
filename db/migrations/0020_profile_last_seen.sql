ALTER TABLE "profiles"
  ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint

UPDATE "profiles" AS "profile"
SET "last_seen_at" = COALESCE(
  "auth_user"."last_sign_in_at",
  "profile"."created_at",
  now()
)
FROM "auth"."users" AS "auth_user"
WHERE "auth_user"."id" = "profile"."id";--> statement-breakpoint

UPDATE "profiles"
SET "last_seen_at" = COALESCE("created_at", now())
WHERE "last_seen_at" IS NULL;--> statement-breakpoint

ALTER TABLE "profiles"
  ALTER COLUMN "last_seen_at" SET DEFAULT now(),
  ALTER COLUMN "last_seen_at" SET NOT NULL;
