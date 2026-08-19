# Plan 030: Split `resolveFantasyMatchupWeek` into pure mapping + external window adapter

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next step. If anything in the “STOP conditions” section occurs, stop and report — do not improvise.
>
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f78943f..HEAD -- lib/leagues/matchup-week.ts lib/leagues/matchup-week.test.ts`
> If any in-scope file changed since this plan was written, compare the “Current state” excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `f78943f`, 2026-08-19

## Why this matters

Week boundary truth is critical for roster/matchup/score navigation. Today, `resolveFantasyMatchupWeek` mixes:
- external data fetching (Sleeper state, ESPN scoreboard windows)
- pure mapping logic (transform fetched windows into fantasy week number + labels)

This reduces locality and testability: deterministic tests should cover the mapping without needing external fetch calls.

Splitting makes future changes safer and helps callers compute `currentWeek` cheaply (see Plan 026).

## Current state

### External fetch inside the resolver

`lib/leagues/matchup-week.ts:140-178`
```ts
  let defaultWeek = 1;
  let calendarWeeks: ScheduleWeek[] = [];
  try {
    const state = await getNflState();
    const sleeperWeek = Number(state.season) === options.seasonYear
      ? fantasyWeekFromNflState(state, settings)
      : null;

    const bootstrapNfl = fantasyWeekToNfl(sleeperWeek ?? 1, settings);
    const board = await getNflScoreboard({ season: options.seasonYear, week: bootstrapNfl?.week ?? 1, seasonType: ..., calendarSeasonTypes });
    calendarWeeks = board.weeks;

    const calendarWeek = fantasyWeekFromCalendarWeeks(calendarWeeks, settings);
    if (calendarWeek != null) defaultWeek = ...;
    else if (sleeperWeek != null) defaultWeek = ...;
    ...
  } catch {
    defaultWeek = 1;
  }
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test` | exit 0 |

## Scope

**In scope**:
- Refactor `lib/leagues/matchup-week.ts` to introduce:
  - a pure mapping helper that accepts fetched inputs (calendarWeeks, sleeperWeek, settings, maxWeek, requestedWeek) and returns `{ week, weeks, calendarWeeks, currentWeek }` deterministically
  - an adapter function that performs external fetches and returns `{ state, sleeperWeek, calendarWeeks }`
- Update tests to cover the pure mapping helper.

**Out of scope**:
- Any changes to the Wednesday 00:01 UTC boundary behavior (must keep existing passing tests).

## Git workflow

- Branch: `advisor/030-week-resolver-pure-mapping-adapter`
- Commit message example: `Split fantasy week resolver into pure mapping + adapter`
- Do NOT push unless instructed.

## Steps

### Step 1: Extract a pure mapping function

In `lib/leagues/matchup-week.ts`:
1. Create a new pure helper (not exported unless needed for tests), e.g.:
   ```ts
   function resolveFantasyMatchupWeekFromFetchedWindows(input: {
     settings: ScheduleSettingsValues
     maxWeek: number
     calendarWeeks: ScheduleWeek[]
     sleeperWeek: number | null
     requestedWeek: number | null
   }): { week: number; weeks: FantasyWeekOption[]; calendarWeeks: ScheduleWeek[]; currentWeek: number }
   ```
2. Move all logic that computes `calendarWeek`, `defaultWeek/currentWeek`, and builds `weeks[]` into this pure helper.
3. Ensure it does not call `getNflState` or `getNflScoreboard`.

**Verify**:
- No behavior changes: keep `resolveFantasyMatchupWeek` using this helper.
- `pnpm typecheck`

### Step 2: Extract an external fetch adapter

Create a function that performs:
- `getNflState`
- `getNflScoreboard`

and returns:
- `sleeperWeek` (or null)
- `calendarWeeks` (possibly empty if fetch fails)

Keep the existing try/catch fallback semantics (`defaultWeek = 1`) at the adapter/orchestrator level, but do not hide mapping errors inside the pure helper.

**Verify**:
- `pnpm lint`
- `pnpm typecheck`

### Step 3: Add tests for pure mapping

Update `lib/leagues/matchup-week.test.ts` to add coverage for:
- mapping behavior when `calendarWeeks` yield a `calendarWeek != null`
- mapping behavior when `calendarWeek == null` and `sleeperWeek != null`
- `requestedWeek` selection rules

Prefer reusing existing fixtures and tests already present for `fantasyWeekFromCalendarWeeks`.

**Verify**:
- `pnpm test`

## Test plan

- Extend `lib/leagues/matchup-week.test.ts` only.

## Done criteria

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test` exits 0
- [ ] Existing week boundary behavior remains unchanged (Wednesday 00:01 UTC rule)
- [ ] `plans/README.md` status row updated

## STOP conditions

- If any test indicates semantic drift in week boundary behavior, stop and report with failing assertion details.

