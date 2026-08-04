-- Sleeper depth chart order (1 = starter at that position)
alter table "players" add column if not exists "depth_chart_order" integer;
