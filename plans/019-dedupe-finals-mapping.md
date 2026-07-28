# Plan 019: Deduplicate finals → per-team points mapping

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- lib/leagues/team-stats-charts.ts lib/leagues/league-overview.ts lib/leagues/hall-of-fame.ts lib/leagues/matchups/finalize.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (safer after Team Stats tests exist — `lib/leagues/team-stats-charts.test.ts`)
- **Category**: tech-debt
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

The same `homePts`/`awayPts` null-check + dual push into per-team week rows is copy-pasted across Team Stats builders, league overview, hall of fame, schedule display, and finalize records helpers. Edge cases (ties, null pts) drift when one copy is fixed.

## Current state

Near-duplicate blocks in:
- `lib/leagues/team-stats-charts.ts` (multiple builders ~74–85, 164–182, 312–323, 405–416)
- `lib/leagues/league-overview.ts` (`weeklyResultsFromFinals`)
- `lib/leagues/hall-of-fame.ts`
- schedule-display helper
- `recordsFromFinalMatchups` in finalize

Existing tests: `team-stats-charts.test.ts`, `hall-of-fame.test.ts`, `league-overview.test.ts`

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `pnpm test -- lib/leagues/team-stats-charts` etc. | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |

## Scope

**In scope**:
- New helper module e.g. `lib/leagues/matchups/expand-finals.ts` with `expandFinalMatchupRows(finals)` returning per-team week rows
- Migrate the listed call sites to the helper
- Keep exported chart/overview APIs stable

**Out of scope**:
- Changing chart UI
- Plan 006 snapshot work
- God-file action splits (025)

## Git workflow

- Branch: `advisor/019-dedupe-finals-mapping`
- Commit message example: `Share one finals-to-per-team points expander across analytics builders.`
- Do NOT push unless instructed.

## Steps

### Step 1: Write helper + characterization tests

Port one existing expansion into the helper; lock ties/null pts behavior with tests **before** migrating other sites.

### Step 2: Migrate call sites one module at a time

After each migration, run that module’s tests.

### Step 3: Remove dead local copies

**Verify**: full `pnpm test` for affected packages; typecheck

## Test plan

- Helper: W/L/T assignment, null pts skip, bye/null opponent if applicable
- Existing chart/HoF/overview tests remain green

## Done criteria

- [ ] Single expander used by Team Stats + overview + HoF (+ finalize records if straightforward)
- [ ] `pnpm test`, `pnpm typecheck` exit 0
- [ ] `plans/README.md` 019 → DONE

## STOP conditions

- One site’s semantics intentionally differ (document and leave that site alone)
- Refactor wants to change win/loss rules — out of scope

## Maintenance notes

- New analytics features should import the shared expander
