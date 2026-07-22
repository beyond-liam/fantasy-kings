-- Player bio fields from Sleeper /v1/players/nfl
alter table "players" add column if not exists "age" integer;
alter table "players" add column if not exists "height" text;
alter table "players" add column if not exists "weight" text;
alter table "players" add column if not exists "college" text;
alter table "players" add column if not exists "jersey_number" integer;
