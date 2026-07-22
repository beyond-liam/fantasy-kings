# Plan 001: Add week-scoped index on `player_scores`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5b6e84a0e4895a6a3978ffca7b458953f803c968..HEAD -- db/schema/player-scores.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `5b6e84a`, 2026-07-14

## Why this matters

Every rankings / players / draft / team scoreboard path joins `player_scores` on `(season, week, kind, season_type)` without filtering by `player_id` first. The only index today leads with `player_id`, so Postgres cannot use it efficiently for “all players for week W” scans. Adding a matching btree index is cheap and benefits Plans 002–004.

## Current state

- `db/schema/player-scores.ts` — Drizzle table for projections/stats JSONB rows.
- Hot join (do not change in this plan): `lib/queries/players.ts:89-97` filters
  `season`, `week`, `kind`, `seasonType` with no `player_id`.

Current indexes only:

```38:45:db/schema/player-scores.ts
  (table) => [
    uniqueIndex("player_scores_unique_idx").on(
      table.playerId,
      table.season,
      table.week,
      table.seasonType,
      table.kind,
    ),
  ],
```

Repo conventions:

- Schema files live under `db/schema/`; push with `pnpm db:push` (see `package.json`).
- Spec: free-tier Supabase; smallest increments (`docs/PROJECT_SPEC.md` §2, `AGENTS.md`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Push schema | `pnpm db:push` | exit 0; Drizzle reports changes applied |
| Lint | `pnpm lint` | exit 0 |

## Scope

**In scope**:
- `db/schema/player-scores.ts`
- `plans/README.md` (status row only)

**Out of scope**:
- Query rewrites in `lib/queries/players.ts` (Plans 002–004)
- Indexes on `player_external_ids` or `roster_players` (deferred)
- Seed scripts

## Git workflow

- Branch: `advisor/001-player-scores-week-index`
- Commit message style (repo has only “Initial commit” so far): short imperative sentences, e.g. `Add player_scores week lookup index`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the composite index in the schema

In `db/schema/player-scores.ts`, import `index` from `drizzle-orm/pg-core` (already imports other builders from that package). Extend the table callback to include:

```ts
index("player_scores_season_week_kind_idx").on(
  table.season,
  table.week,
  table.seasonType,
  table.kind,
),
```

Keep the existing unique index unchanged.

**Verify**: `rg "player_scores_season_week_kind_idx" db/schema/player-scores.ts` → one match.

### Step 2: Push to the database

Run `pnpm db:push` with network/env available (needs `.env.local` `DATABASE_URL` / `DIRECT_URL`).

**Verify**: exit 0 and output indicates the new index was created (or “No changes” only if it already exists — then confirm via Drizzle Studio or `psql` that the index name exists). If push fails for auth/env, STOP and report.

### Step 3: Update plan status

Set this plan’s row in `plans/README.md` to `DONE`.

## Test plan

- No unit test required for a schema-only index.
- Optional smoke (not required): open Rankings after push and confirm page still loads.

## Done criteria

- [ ] `player_scores_season_week_kind_idx` exists in `db/schema/player-scores.ts`
- [ ] Unique index untouched
- [ ] `pnpm db:push` succeeded (or STOP documented if env blocked)
- [ ] No files outside scope modified
- [ ] `plans/README.md` status = DONE

## STOP conditions

- Schema excerpt no longer matches (drift).
- `db:push` fails twice for non-auth reasons.
- Tempted to change query logic — that belongs in later plans.

## Maintenance notes

- Seed upserts still hit the unique index; this new index adds write cost on inserts — acceptable for free-tier reader load.
- Reviewer: confirm column order matches the join predicates in `getRankedPlayers`.
