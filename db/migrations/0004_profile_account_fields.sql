-- User profile fields for account settings.
alter table "profiles" add column if not exists "username" text;
alter table "profiles" add column if not exists "first_name" text;
alter table "profiles" add column if not exists "last_name" text;
alter table "profiles" add column if not exists "avatar_url" text;

-- Backfill username from display_name where missing (unique per row).
update "profiles"
set "username" = lower(
  regexp_replace(
    coalesce(nullif(trim("display_name"), ''), 'user'),
    '[^a-zA-Z0-9]+',
    '',
    'g'
  )
) || '_' || substr(replace("id"::text, '-', ''), 1, 6)
where "username" is null;

create unique index if not exists "profiles_username_unique_idx"
  on "profiles" ("username");
