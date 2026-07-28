# Plan 018: Remove dead mocks and gate design previews

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- lib/mock/ lib/leagues/*-mock.ts app/league/`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/016-sync-project-spec.md` (docs should not still recommend typed mocks for shipped screens)
- **Category**: tech-debt
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

`lib/mock/leagues.ts` exports `mockLeagues` with **no importers**. Design previews `?mock=1` still power Team Stats / Overview roast via `*-mock.ts` files, which can mask empty real data during beta QA.

## Current state

- `lib/mock/leagues.ts` — unused
- `lib/leagues/team-stats-charts-mock.ts`, `overview-weekly-roast-mock.ts` — used when `searchParams.mock` is `1`/`true` on league home / team pages
- Empty states should exist for charts without mock

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Grep | `rg -n "mockLeagues|team-stats-charts-mock|getOverviewWeeklyRoastMock" -g '!plans/**'` | only intentional remaining refs |
| Typecheck | `pnpm typecheck` | exit 0 |

## Scope

**In scope**:
- Delete unused `lib/mock/leagues.ts` (and empty dirs if any)
- Either remove `?mock=1` branches **or** gate them behind `process.env.NODE_ENV === "development"` so production beta cannot enable mocks via URL
- Update PROJECT_SPEC if it still mentions mock preview for those screens (coordinate with 016)

**Out of scope**:
- Deleting all mock helpers if designers still need them in development — prefer env gate over hard delete of chart mocks
- Redesigning empty states beyond ensuring they render without mock

## Git workflow

- Branch: `advisor/018-remove-dead-mocks`
- Commit message example: `Remove unused league mocks and restrict design preview mocks to development.`
- Do NOT push unless instructed.

## Steps

### Step 1: Confirm dead code

`rg -n "mockLeagues|from \\\"@/lib/mock"` — if only the definition file, delete it.

### Step 2: Gate ?mock=1

```ts
const useOverviewMock =
  process.env.NODE_ENV === "development" &&
  (mock === "1" || mock === "true");
```

Apply on both league home and team pages.

### Step 3: Typecheck

**Verify**: `pnpm typecheck`; `pnpm lint`

## Test plan

No new tests required; ensure empty chart paths still typecheck.

## Done criteria

- [ ] Unused `lib/mock/leagues.ts` gone
- [ ] Production builds ignore `?mock=1`
- [ ] `pnpm typecheck` exit 0
- [ ] `plans/README.md` 018 → DONE

## STOP conditions

- Something still imports `mockLeagues` from an unexpected path — update callers or STOP
- Empty states are broken without mock — fix empty UI minimally before removing prod mock access

## Maintenance notes

- Designers: use `pnpm dev` + `?mock=1` only
