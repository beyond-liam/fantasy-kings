# Plan 004: Finalize playoff weeks and surface advancement errors

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- lib/leagues/matchups/finalize.ts lib/leagues/playoffs/ensure-matchups.ts app/api/cron/sync-scores/route.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/003-characterize-score-sync-finalize.md`
- **Category**: bug
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

Playoff bracket advancement requires every prior playoff matchup `status === "final"` before inserting the next round (`lib/leagues/playoffs/ensure-matchups.ts:209`). But `finalizeDueMatchupsAfterScoreSync` only walks weeks up to `regularSeasonEndWeek`, so playoff rows never finalize. Advancement failures are also swallowed with `.catch(() => null)`, and the cron skips finalize entirely when upsert count is 0. Result: brackets stall in round 1 during a live season.

## Current state

`lib/leagues/matchups/finalize.ts`:

```ts
const maxWeek = Math.min(
  input.week,
  season.regularSeasonEndWeek,
  18,
);
for (let week = 1; week <= maxWeek; week++) {
  // ...
}
await ensurePlayoffMatchupsAdvanced({
  leagueSeasonId: season.id,
  currentNflWeek: input.currentNflWeek ?? input.week,
}).catch(() => null);
```

(Exact call uses `currentNflWeek: input.week` today at lines 377–380.)

`app/api/cron/sync-scores/route.ts:116-120`:

```ts
if (!sleeper.skipped && upserted > 0) {
  finalize = await finalizeDueMatchupsAfterScoreSync({ ... });
}
```

`ensure-matchups.ts:209`: `if (!weekRows.every((row) => row.status === "final")) continue;`

Product vocabulary: playoff weeks start after `regularSeasonEndWeek`; championship may be two-week rematch (already shipped). Do not invent new playoff rules — only make finalize visit playoff weeks that already exist as matchup rows.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Unit/DB tests | `pnpm test` / `pnpm test:db` | exit 0; updated assertions |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |

## Scope

**In scope**:
- `lib/leagues/matchups/finalize.ts` — week upper bound; advancement error handling/return
- `app/api/cron/sync-scores/route.ts` — finalize when sync not skipped even if upserted === 0; include finalize/advancement errors in JSON payload when present
- `lib/leagues/playoffs/ensure-matchups.ts` — only if needed for idempotent insert (`onConflictDoNothing`) to reduce duplicate-insert noise; keep pairing logic unchanged (order fix is plan 010)
- Tests created/updated in plan 003 for max-week / finalize gate / advancement

**Out of scope**:
- Lineup snapshots / official corrections (plan 006)
- Scoreboard missing-progress semantics (plan 005)
- Deterministic pairing order (plan 010)
- Changing playoff settings UX

## Git workflow

- Branch: `advisor/004-finalize-playoff-weeks`
- Commit message example: `Finalize playoff weeks after score sync and surface advancement errors.`
- Do NOT push unless instructed.

## Steps

### Step 1: Extend finalize week range through playoffs

Compute max week as the maximum of:
- `input.week` (clamped)
- and the season's playoff end (championship week / last playoff week)

Use existing helpers if present (`getPlayoffWeekRange` from `@/lib/leagues/season-calendar` is used elsewhere). Pattern:

```ts
const playoffRange = getPlayoffWeekRange(/* season fields already on row */);
const seasonCap = playoffRange?.endWeek ?? season.regularSeasonEndWeek;
const maxWeek = Math.min(input.week, seasonCap, 18);
```

If `getPlayoffWeekRange` needs fields not on the finalize season select, extend the season query in the same file only as needed.

Still skip weeks with no matchup rows. Do not invent playoff matchups here — `ensurePlayoffMatchupsAdvanced` remains responsible for inserts.

**Verify**: update plan-003 characterization that expected RS-only cap — flip it so a playoff week ≤ `input.week` is included in the max. `pnpm test` / `pnpm test:db` pass

### Step 2: Stop swallowing advancement errors

Replace `.catch(() => null)` with:

1. `try/catch` that logs via `console.error` (or existing logger if the repo has one — do not add a new logging framework)
2. Accumulate `{ leagueSeasonId, error: message }` into the finalize return value

Return shape extension example:

```ts
return {
  seasonsChecked,
  weeksChecked,
  finalized,
  inProgress,
  corrected,
  playoffAdvanceErrors: [...] as { leagueSeasonId: string; error: string }[],
};
```

Cron response already spreads finalize into JSON — errors become visible to cron-job.org logs.

**Verify**: unit test or dbtest that a thrown ensure failure appears in `playoffAdvanceErrors` and does not abort processing of other seasons

### Step 3: Run finalize after non-skipped sync even when upserted === 0

In `sync-scores/route.ts`:

```ts
if (!sleeper.skipped) {
  finalize = await finalizeDueMatchupsAfterScoreSync({
    seasonYear: sleeper.season,
    week: sleeper.week,
  });
}
```

Update the plan-003 `shouldFinalizeAfterSync` helper/tests accordingly.

**Verify**: `pnpm test` covers upserted 0 → still finalize; typecheck passes

### Step 4: Optional idempotent playoff inserts

If `insertPairings` can throw on unique `(leagueSeasonId, week, homeTeamId, awayTeamId)`, switch to `onConflictDoNothing` **only** on that insert. Do not change pairing selection.

**Verify**: `pnpm typecheck`; existing playoff advance tests still pass (`pnpm test -- lib/leagues/playoffs`)

## Test plan

- Flip characterization: playoff week is visited / can become final when scoreboard says final (may need mocked games — keep fixtures minimal)
- Advancement error appears in return payload
- Finalize runs when upserted === 0 and sleeper not skipped
- Regression: regular-season finalize still works (existing or new dbtest)

## Done criteria

- [ ] Finalize max week includes playoff weeks through championship when `input.week` allows
- [ ] No `.catch(() => null)` on `ensurePlayoffMatchupsAdvanced`
- [ ] Cron finalizes on non-skipped sync regardless of upsert count
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db` exit 0
- [ ] `plans/README.md` 004 → DONE

## STOP conditions

- Season row lacks fields needed for playoff range and adding them requires schema migration
- Finalizing playoffs early without plan 005's safer final heuristic looks unsafe in a live week — implement week visitation + status rules carefully; if unsure whether a playoff row should finalize, STOP with the scenario
- Plan 003 tests are missing — do not proceed; execute 003 first

## Maintenance notes

- Reviewer: confirm two-week championship rematch path still skips advance between leg1/leg2 (`ensure-matchups.ts` already continues on that case)
- After 005, playoff finals will be stricter about ESPN outages — keep that interaction in mind
