# Plan 003: Characterize score sync + matchup finalize

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- lib/leagues/matchups/finalize.ts app/api/cron/sync-scores/route.ts lib/queries/week-matchup-board.ts lib/scores/`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: none (must land **before** plans 004–006)
- **Category**: tests
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

Live scores → finalize → playoff advancement is the money-adjacent spine of a real NFL week. Today `lib/scores/*` and `lib/leagues/matchups/finalize.ts` (~500 lines) have **zero** tests. Plans 004–006 will change this code; without characterization tests, regressions rewrite W/L silently. This plan adds tests that lock **current** behavior (including known bugs) so later plans can flip assertions deliberately.

## Current state

- Cron: `app/api/cron/sync-scores/route.ts` — Sleeper → ESPN → optional nflverse → finalize only when `!sleeper.skipped && upserted > 0` (lines 108–120)
- Finalize loop: `lib/leagues/matchups/finalize.ts:326-330` caps weeks at `Math.min(input.week, season.regularSeasonEndWeek, 18)` — **playoff weeks never enter the loop**
- Advancement: `finalize.ts:377-380` calls `ensurePlayoffMatchupsAdvanced(...).catch(() => null)` — errors swallowed
- Final heuristic: `lib/queries/week-matchup-board.ts:218-228` — `allStartersFinal` treats `progress == null` as final
- nflverse auto gate: `sync-scores/route.ts:93-97` — `shouldRunNflverse = !hasLive && (hasPost || games.length === 0)`
- DB test pattern: `lib/leagues/trades/lifecycle.dbtest.ts` using `createTestDb` + `seedLeagueSeason` / `seedTeams` from `@/lib/test/*`
- Unit test pattern: `node:test` + `tsx --test` via `pnpm test`; dbtests via `pnpm test:db`

Documented product intent (`docs/PROJECT_SPEC.md`): live Sleeper + ESPN boxscores; nflverse post-week replace; optional `applyOfficialStatChanges`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Unit tests | `pnpm test -- lib/leagues/matchups` or full `pnpm test` | exit 0 |
| DB tests | `pnpm test:db -- lib/leagues/matchups` or full `pnpm test:db` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |

## Scope

**In scope**:
- New unit tests for pure helpers extracted **only if** needed for testability — prefer testing existing exported functions first
- Prefer extracting tiny pure helpers from finalize / week-matchup-board / sync-scores **without changing behavior** when a helper is currently inline and untestable
- New files such as:
  - `lib/queries/week-matchup-board.test.ts` (or colocated next to `allStartersFinal` if you must export it for testing)
  - `lib/leagues/matchups/finalize.test.ts` and/or `finalize.dbtest.ts`
  - Optional: `lib/scores/nflverse-gate.test.ts` if you extract the `shouldRunNflverse` predicate from the route
- Minimal production exports/refactors **only** to make characterization possible (e.g. export `allStartersFinal`, extract `shouldAutoRunNflverse({ games, force })`)

**Out of scope**:
- Fixing playoff finalize, outage gates, lineup snapshots, or nflverse logic (plans 004–006)
- Changing cron auth
- Hitting real Sleeper/ESPN/nflverse network in tests

## Git workflow

- Branch: `advisor/003-characterize-score-sync-finalize`
- Commit message example: `Add characterization tests for score sync and matchup finalize.`
- Do NOT push unless instructed.

## Steps

### Step 1: Characterize `allStartersFinal` (current buggy semantics)

If `allStartersFinal` is not exported, export it for testing (same module) **without changing logic**.

Add tests that document today's behavior:

1. Empty lineup → `false`
2. Every starter's NFL team has `progress.status === "post"` → `true`
3. Any starter with `progress.status === "in"` → `false`
4. **Bug lock-in**: starter with known NFL abbrev but **missing** progress map entry → currently `true` (because `progress == null` is treated as final). Name the test clearly: `treats missing progress as final (current behavior)`.

**Verify**: `pnpm test -- lib/queries/week-matchup-board` (or whatever path you chose) → pass

### Step 2: Extract and characterize nflverse auto-run predicate

Move the boolean decision from `sync-scores/route.ts` into a pure function, e.g. in `lib/scores/nflverse-run-gate.ts`:

```ts
export function shouldAutoRunNflverse(input: {
  force: boolean;
  scoreboardOk: boolean; // false when fetch threw / returned null
  games: { status: string }[];
}): boolean
```

**Keep current behavior**: when `scoreboardOk` is false, treat as `games = []` so auto-run still becomes true when not forced (today's bug). Document that in the test name. Plan 005 will flip `scoreboardOk === false` → do not auto-run.

Cases:
- `force: true` → true
- live game present → false (unless force)
- all post, no live → true
- empty games + scoreboardOk true → true (current)
- scoreboardOk false → true under current emulation of `board?.games ?? []` (lock in)

Wire the route to call the helper without changing outcomes.

**Verify**: `pnpm test -- lib/scores` → pass; route still typechecks

### Step 3: Finalize week-cap characterization (unit or dbtest)

Add a test that proves finalize's week upper bound uses `regularSeasonEndWeek` and does **not** include `regularSeasonEndWeek + 1` when that is a playoff week.

Approaches (pick one):

**A (preferred if feasible without huge harness):** export a pure `finalizeMaxWeek({ inputWeek, regularSeasonEndWeek })` used by the loop, unit-test it returning `Math.min(...)`.

**B:** dbtest: seed a season with `regularSeasonEndWeek = 14`, playoff matchup at week 15 `status = 'scheduled'`, call `finalizeDueMatchupsAfterScoreSync` with week 15 and empty/mocked scoreboard path — assert playoff row still not `final` (current bug). Use `createTestDb` pattern from `lifecycle.dbtest.ts`.

Also characterize: finalize is only invoked from cron when `upserted > 0` — if testing the route is hard, document this as a comment + a unit test on a tiny extracted `shouldFinalizeAfterSync({ sleeperSkipped, upserted })` matching lines 116–120.

**Verify**: `pnpm test` and `pnpm test:db` (if you added dbtests) pass

### Step 4: Document advancement swallow

Add a short comment above `.catch(() => null)` in `finalize.ts:377-380` noting that plan 004 will log/surface errors — **or** add a test double hook if one already exists. Do not change behavior here.

**Verify**: no behavior change; `git diff` limited to comments/tests/helper extracts

## Test plan

| Case | File | Asserts |
|------|------|---------|
| Missing NFL progress → final | week-matchup-board test | current true |
| Empty nflverse board → auto run | nflverse gate test | current true |
| Max finalize week caps at RS end | finalize helper/dbtest | playoff week skipped |
| Finalize gate on upserted | helper test | upserted 0 → false |

Model after `lib/leagues/trades/lifecycle.dbtest.ts` for DB and `lib/leagues/scoring/schema.test.ts` for pure unit style.

## Done criteria

- [ ] Characterization tests exist and pass for the four behaviors above
- [ ] Any extracted helpers preserve identical runtime decisions
- [ ] `pnpm test` and (if used) `pnpm test:db` exit 0
- [ ] `pnpm typecheck` exit 0
- [ ] No intentional bug fixes (those are 004–006)
- [ ] `plans/README.md` 003 → DONE

## STOP conditions

- Extracting a helper would require rewriting half of finalize — stop and ask for a narrower spike
- PGlite harness cannot seed matchups/seasons needed for option B — fall back to option A and report
- You find yourself "fixing" missing-progress-as-final while writing tests — that belongs in plan 005

## Maintenance notes

- Plans 004–006 must update these characterization tests when flipping buggy assertions.
- Reviewer: ensure test names say "current behavior" where they lock bugs; avoid soft assertions that hide the bug.
