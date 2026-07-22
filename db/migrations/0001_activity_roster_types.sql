-- AlterEnum
ALTER TYPE "public"."league_activity_type" ADD VALUE IF NOT EXISTS 'player_added';
ALTER TYPE "public"."league_activity_type" ADD VALUE IF NOT EXISTS 'player_dropped';
ALTER TYPE "public"."league_activity_type" ADD VALUE IF NOT EXISTS 'ir_added';
ALTER TYPE "public"."league_activity_type" ADD VALUE IF NOT EXISTS 'ir_removed';
ALTER TYPE "public"."league_activity_type" ADD VALUE IF NOT EXISTS 'taxi_added';
ALTER TYPE "public"."league_activity_type" ADD VALUE IF NOT EXISTS 'taxi_removed';
