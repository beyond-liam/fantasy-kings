# Plan 026: Make `ensureTeamRosterSlotsAssigned` require an explicit `currentWeek`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the “STOP conditions” section occurs, stop and report — do
> not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f78943f..HEAD -- lib/queries/team-roster.ts app/league/[leagueId]/team/page.tsx components/team/panels/my-team-keepers.tsx app/league/[leagueId]/settings/keepers/page.tsx app/league/[leagueId]/settings/edit-roster/page.tsx`
> If any in-scope file changed since this plan was written, compare the “Current state” excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `f78943f`, 2026-08-19

## Why this matters

`lib/queries/team-roster.ts` currently has an implicit sequencing/performance contract: callers *may* pass `currentWeek`, but if they omit it the module resolves it by calling `resolveFantasyMatchupWeek` (external ESPN/Sleeper bootstrapping).

This drift-prone implicit contract shows up in routes like `app/league/[leagueId]/team/page.tsx` which call `ensureTeamRosterSlotsAssigned` without `currentWeek`. That forces extra external fetch work and makes “what week is current” correctness more fragile.

## Current state

### `ensureTeamRosterSlotsAssigned` resolves week implicitly

`lib/queries/team-roster.ts:38-60`
```ts
  let currentWeek = input.currentWeek;
  if (currentWeek == null && input.seasonYear != null && input.regularSeasonEndWeek != null) {
    const resolved = await resolveFantasyMatchupWeek({
      seasonYear: input.seasonYear,
      nflRegularSeasonEndWeek: input.regularSeasonEndWeek,
      schedule: input.schedule,
    });
    currentWeek = resolved.currentWeek;
  }
  if (currentWeek == null) {
    currentWeek = 1;
  }
  await applyDueLineupPlans({
    leagueSeasonId: input.leagueSeasonId,
    currentWeek,
    rosterSlots: input.rosterSlots,
    benchSlots: input.benchSlots,
    teamId: input.teamId,
  });
```

### A call site omits `currentWeek`

`app/league/[leagueId]/team/page.tsx:141-163`
```ts
  team
    ? ensureTeamRosterSlotsAssigned({
        teamId: team.id,
        rosterSlots: season.settings.rosterSlots,
        benchSlots: season.benchSlots,
        irEnabled: season.irEnabled,
        taxiEnabled: season.taxiEnabled,
        leagueSeasonId: season.id,
        schedule: season.settings.schedule,
        seasonYear: season.seasonYear,
        regularSeasonEndWeek: season.regularSeasonEndWeek,
        // NOTE: no currentWeek
      }).then(() => getTeamRosterPlayers(team.id))
    : Promise.resolve([]),
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test` | exit 0 |
| DB tests | `pnpm test:db` | exit 0 |

## Scope

**In scope**:
- Update `lib/queries/team-roster.ts` to add an explicit, deep interface that does *not* resolve week implicitly.
- Update all existing call sites that omit `currentWeek` to pass it (compute it once using `resolveFantasyMatchupWeek` at the caller).

**Out of scope**:
- Behavior changes to lineup assignment rules (only make `currentWeek` explicit).
- Any change to the week-boundary logic in `lib/leagues/matchup-week.ts` (this plan only changes call patterns / locality).

## Git workflow

- Branch: `advisor/026-roster-ensure-current-week-explicit`
- Commit message example: `Make roster ensure-week explicit`
- Do NOT push unless instructed.

## Steps

### Step 1: Introduce a deep “explicit week” module function

In `lib/queries/team-roster.ts`:
1. Add a new exported function, e.g. `ensureTeamRosterSlotsAssignedForWeek`, whose interface **requires** `currentWeek: number` and calls `applyDueLineupPlans` using exactly that value (no call to `resolveFantasyMatchupWeek` inside).
2. Keep the existing `ensureTeamRosterSlotsAssigned` export for backward compatibility, but implement it as a thin adapter:
   - If `input.currentWeek` is present, call `ensureTeamRosterSlotsAssignedForWeek`.
   - Otherwise, resolve `currentWeek` (legacy behavior), then call `ensureTeamRosterSlotsAssignedForWeek`.

**Verify**:
- `pnpm typecheck`
- No route should break due to missing exports.

### Step 2: Update call sites to pass `currentWeek`

Update every call site of `ensureTeamRosterSlotsAssigned` that can reasonably compute `currentWeek`:
1. Find call sites via `rg "ensureTeamRosterSlotsAssigned\\("`.
2. For each call site that omits `currentWeek`, compute it once by calling `resolveFantasyMatchupWeek` in that route/component, then pass `currentWeek` through to `ensureTeamRosterSlotsAssignedForWeek` (prefer it over the legacy export).

At minimum, update these known locations:
- `app/league/[leagueId]/team/page.tsx`
- `components/team/panels/my-team-keepers.tsx`
- `app/league/[leagueId]/settings/keepers/page.tsx`
- `app/league/[leagueId]/settings/edit-roster/page.tsx`

**Verify**:
- `pnpm lint`
- `pnpm typecheck`

### Step 3: Add a regression/characterization assertion

Add a small DB/integration-level test (or extend an existing one) that proves `applyDueLineupPlans` is driven by the caller’s `currentWeek`, not an implicit resolver call.

If there is an existing DB harness for lineup plans, follow its pattern; otherwise, keep this at the unit level by asserting:
- when `currentWeek` is passed, `resolveFantasyMatchupWeek` is not invoked by the “explicit week” function.

**Verification**:
- `pnpm test`
- `pnpm test:db`

## Test plan

- Extend/introduce tests in the same test style as existing domain DB tests (DB harness in `lib/test/harness`).
- Target the exact regression risk: omitted `currentWeek` causing implicit resolver behavior.

## Done criteria

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test` exits 0
- [ ] `pnpm test:db` exits 0
- [ ] `git status` shows only expected plan-related changes (executors run in a disposable worktree)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The code at the “Current state” excerpt locations no longer matches (drift).
- You discover the week resolver is required for correctness beyond “performance bootstrapping”; if so, stop and report.

## Maintenance notes

- Future call sites should use the explicit-week module to preserve locality.
- Reviewers should scrutinize any remaining legacy call to `ensureTeamRosterSlotsAssigned` without `currentWeek`.

