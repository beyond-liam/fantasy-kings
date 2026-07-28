# Plan 015: Unit-test scoring calculate engine

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- lib/leagues/scoring/calculate.ts lib/leagues/scoring/`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

`calculatePlayerPoints` / `evaluateRule` in `lib/leagues/scoring/calculate.ts` drive rankings, Game Centre, finalize, and tie metrics. Only `schema.test.ts` exists — schema validation, not point math. Wrong fantasy points would dispute every live week with no golden fixtures.

## Current state

- `lib/leagues/scoring/calculate.ts` — `evaluateRule` switch on `rule.kind`: simple, per_unit, threshold, threshold_lte, threshold_between, exact, td_range, td_min_yards, …
- Defaults: `lib/leagues/scoring/defaults.ts` + `getDefaultScoringRuleDefinitions`
- Test style: `lib/leagues/scoring/schema.test.ts` using `node:test`

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `pnpm test -- lib/leagues/scoring/calculate` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |

## Scope

**In scope**:
- `lib/leagues/scoring/calculate.test.ts` (create)
- Export `evaluateRule` only if needed for direct testing; prefer testing public `calculatePlayerPoints`

**Out of scope**:
- Changing scoring formulas
- Commissioner UI
- Sync/finalize tests (003)

## Git workflow

- Branch: `advisor/015-scoring-calculate-unit-tests`
- Commit message example: `Add golden unit tests for fantasy point calculation.`
- Do NOT push unless instructed.

## Steps

### Step 1: Table-driven rule kind tests

For each `rule.kind` used in defaults, add a fixture `{ rule, stats, position, expected }`.

Cover:
- Position filter excludes rule when position not in `rule.positions`
- Null/missing stats → 0 contribution
- `per_unit` with `every` and with `rate`
- Threshold inclusive boundaries
- One full_ppr default bag for a sample RB receiving line → locked total

**Verify**: `pnpm test -- lib/leagues/scoring/calculate` exit 0

### Step 2: Regression fixture from defaults

Build rules via `getDefaultScoringRuleDefinitions("full_ppr")` and assert a documented total for a fixed stat bag (include the bag in the test comment).

**Verify**: test fails if someone changes default PPR reception points without updating the fixture (intentional)

## Test plan

All in `calculate.test.ts`. No network/DB.

## Done criteria

- [ ] `calculate.test.ts` covers each major rule kind + one default preset golden total
- [ ] `pnpm test`, `pnpm typecheck` exit 0
- [ ] `plans/README.md` 015 → DONE

## STOP conditions

- Private helpers cannot be tested without large refactors — test only exported API
- Default preset total is non-deterministic — it should be pure; if not, STOP

## Maintenance notes

- When adding a new `rule.kind`, add a calculate test in the same PR
- Reviewer: ensure fixtures use realistic Sleeper-like stat keys from `stat-keys.ts`
