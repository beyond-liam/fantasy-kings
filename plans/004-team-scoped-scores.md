# Plan 004: Scope My Team score loads to roster/watchlist IDs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5b6e84a0e4895a6a3978ffca7b458953f803c968..HEAD -- app/league/\\[slug\\]/team/page.tsx lib/queries/players.ts`
> If mismatch vs Current state, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (compatible with 002/003; if 003 landed, team pays even less)
- **Category**: perf
- **Planned at**: commit `5b6e84a`, 2026-07-14

## Why this matters

`/league/[slug]/team` runs **three** full-universe `getRankedPlayers` calls (week projection, week stats, season projection) only to look up fantasy points / season rows for the user’s roster and watchlist IDs. That is the heaviest single-page cost after rankings and must stop.

## Current state

IDs already known before the expensive calls:

```160:188:app/league/[slug]/team/page.tsx
  const ratePlayerIds = [
    ...new Set([
      ...rosterPlayers.map((player) => player.id),
      ...watchlistPlayers.map((player) => player.id),
    ]),
  ];

  const [rosterRates, weekProjections, weekStats, seasonProjections] =
    await Promise.all([
      getPlayerRosterRatesMap(ratePlayerIds),
      getRankedPlayers({
        season: nflState.season,
        week: nflWeek,
        kind: "projection",
        scoringRules,
      }).catch(() => []),
      getRankedPlayers({
        season: nflState.season,
        week: nflWeek,
        kind: "stats",
        scoringRules,
      }).catch(() => []),
      rosterIdSet.size > 0
        ? getRankedPlayers({
            season: nflState.season,
            week: 0,
            kind: "projection",
            scoringRules,
          }).catch(() => [])
        : Promise.resolve([]),
    ]);
```

`RankingsFilters` today (`lib/queries/players.ts:16-25`) has no `playerIds`.

Conventions: use `inArray` from `drizzle-orm` (already used elsewhere, e.g. waiver/roster queries). Empty `playerIds` array must short-circuit to `[]` without querying.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `pnpm test` | all pass |
| Lint | `pnpm lint` | exit 0 |

## Scope

**In scope**:
- `lib/queries/players.ts` — extend filters + WHERE
- `app/league/[slug]/team/page.tsx` — pass ID lists
- Optional: `lib/queries/players-ids.test.ts` pure helper if you extract empty-array early return logic; otherwise skip
- `plans/README.md`

**Out of scope**:
- Broader team page waterfall refactor (parallelizing home data earlier)
- Changing roster/watchlist queries
- Rankings/players pages (they should **not** pass `playerIds`)

## Git workflow

- Branch: `advisor/004-team-scoped-scores`
- Commit: `Scope My Team score queries to roster IDs`
- Do NOT push/PR unless asked.

## Steps

### Step 1: Add `playerIds?: string[]` to `RankingsFilters`

In `lib/queries/players.ts`:

1. Extend the type with `playerIds?: string[]`.
2. At the start of `getRankedPlayers`, if `filters.playerIds` is defined and `filters.playerIds.length === 0`, `return []`.
3. Import `inArray` from `drizzle-orm`.
4. When `filters.playerIds` is a non-empty array, push `inArray(players.id, filters.playerIds)` onto `playerConditions`.

**Verify**: `rg "playerIds" lib/queries/players.ts` shows type + condition.

### Step 2: Pass IDs from the team page

Replace the three `getRankedPlayers` calls:

- Week projection / week stats: use `playerIds: ratePlayerIds` (roster ∪ watchlist). If `ratePlayerIds.length === 0`, pass `[]` or skip with `Promise.resolve([])`.
- Season projections: use `playerIds: [...rosterIdSet]` (existing season filter already roster-only at `:216-218`). If empty, keep `Promise.resolve([])`.

Keep `.catch(() => [])` behavior.

**Verify**: `rg "playerIds:" app/league/\\[slug\\]/team/page.tsx` → three usages (or two + empty short-circuit).

### Step 3: Confirm rankings/draft calls unchanged

`rg "getRankedPlayers\\(" -n app` — rankings, players, draft must **not** pass `playerIds`.

### Step 4: Mark DONE

## Test plan

- Manual: My Team still shows projected/actual PTS and Stats tab season numbers for rostered players.
- No DB integration test required.

## Done criteria

- [ ] Team page never calls full-universe `getRankedPlayers` without `playerIds`
- [ ] Empty ID list does not hit the DB
- [ ] Rankings/draft callers unchanged
- [ ] README DONE

## STOP conditions

- Stats tab needs **all** league players ranking (it shouldn’t — it filters to roster). If product wants league-wide charts, STOP.
- `inArray` with huge ID lists — roster+watchlist is fine; if somehow thousands, STOP.

## Maintenance notes

- Reviewer: ensure season week `0` projection path still used for stats sections.
- Combine with Plan 003 later for even smaller DTOs on team.
