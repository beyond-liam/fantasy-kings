CREATE TABLE "email_sends" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dedupe_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "email_sends_dedupe_key_uidx" ON "email_sends" USING btree ("dedupe_key");
