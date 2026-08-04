-- Short public ids for player profile URLs (/players/{publicId})
alter table "players" add column if not exists "public_id" text;
create unique index if not exists "players_public_id_unique" on "players" ("public_id");
