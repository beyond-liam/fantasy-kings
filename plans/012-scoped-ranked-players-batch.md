# Plan 012: Stop full-league reloads inside scoped ranked players

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- lib/queries/players.ts lib/queries/schedule-win-chance.ts lib/queries/league-stats.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (pairs well after 011)
- **Category**: perf
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

`getRankedPlayers` with `playerIds` still calls `loadScoreRows` for the **entire week** to rebuild fantasy position ranks (`lib/queries/players.ts:244-266`). Schedule win-chance then calls `getRankedPlayers` **per week** (`schedule-win-chance.ts:203-251`), multiplying the cost across a season. My Team roster/schedule and league stats feel slow on cold cache.

## Current state

```ts
// players.ts — scoped path still full-league reloads for ranks
if (filters.playerIds != null) {
  const leagueBase = await loadScoreRows(filters.season, filters.week, filters.kind, undefined, undefined);
  ...
  fantasyRankByPlayerId = buildFantasyPositionRankById(applyScoring(leagueMapped, { ...filters, playerIds: undefined, ... }));
}
```

Position ranks must remain **league-wide** correct for displayed roster players — do not fake ranks from the subset alone.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `pnpm test` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |

## Scope

**In scope**:
- `lib/queries/players.ts` — cache/dedupe week-wide rank maps; scoped loads fetch only needed score rows for points
- `lib/queries/schedule-win-chance.ts` — batch weeks / reuse process-level cache
- Optional `React.cache` wrappers for per-request dedupe of week rank maps
- Tests for rank correctness: scoped player retains same position rank as full-league call

**Out of scope**:
- Paginated players table UI redesign (optional stretch only if ranks work is done)
- Changing scoring math
- Monte Carlo odds (011)

## Git workflow

- Branch: `advisor/012-scoped-ranked-players-batch`
- Commit message example: `Cache league-wide fantasy ranks so scoped player loads stay cheap.`
- Do NOT push unless instructed.

## Steps

### Step 1: Extract week rank map builder

Create an internal helper, e.g. `getFantasyPositionRankMap({ season, week, kind, scoring... })`, wrapped in `React.cache` so multiple scoped calls in one request share one full-week pass.

Scoped `getRankedPlayers`:
1. `loadScoreRows` **with** `playerIds` for the scored subset (points)
2. Attach ranks from the cached full-week map

**Verify**: unit test or thin integration: ranks for a known player match between scoped and unscoped calls

### Step 2: Batch schedule win-chance weeks

Refactor `enrichScheduleWinChances` to:
- Collect needed weeks
- Build rank/score data once per week (via cached helper) rather than N independent full pipelines that re-enter uncached paths
- Preserve live vs finished week progress logic

**Verify**: existing win-probability / schedule tests still pass; add a test if pure helpers extracted

### Step 3: Spot-check call sites

Grep `getRankedPlayers` and `playerIds:` — team page, league stats, projected strength. Ensure they benefit from cache (same request).

**Verify**: `pnpm typecheck`; `pnpm test`

## Test plan

- Rank equality scoped vs full for same filters
- Empty playerIds / undefined path unchanged
- Schedule enrichment returns same shape

## Done criteria

- [ ] Scoped loads do not perform a second uncached full-week scoring pass per call within a request (one shared cached map OK)
- [ ] Schedule win-chance does not naively multiply full-league reloads per week without sharing
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` exit 0
- [ ] `plans/README.md` 012 → DONE

## STOP conditions

- Rank map caching would serve wrong scoring preset across leagues in one request — key the cache by season id + scoring fingerprint
- Changing `loadScoreRows` signatures breaks many callers — keep adapters thin

## Maintenance notes

- Reviewer: verify cache keys include kind (stats vs projection) and season/week
- Players page full-table payload (PERF-08) remains a follow-up; not required here
