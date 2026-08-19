# Plan 029: Make SoS (positional difficulty) failures explicit (no more silent empty maps)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next step. If anything in the “STOP conditions” section occurs, stop and report — do not improvise.
>
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f78943f..HEAD -- lib/queries/positional-sos.ts components/team/panels/my-team-roster.tsx components/team/panels/my-team-stats.tsx`
> If any in-scope file changed since this plan was written, compare the “Current state” excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `f78943f`, 2026-08-19

## Why this matters

SoS difficulty computation currently swallows *all* errors and returns an empty map. That means upstream ESPN/Sleeper parsing changes or DB score-row issues can quietly degrade opponent difficulty without any explicit failure mode.

This plan introduces a deep module interface for SoS that returns a typed success/error result, keeping UI resilient but making the “failure mode” explicit.

## Current state

### SoS computation swallows errors

`lib/queries/positional-sos.ts:145-240`
```ts
const getPositionalSosByTeamCached = cache(async (...) => {
  try {
    const [nflState, currentTotals] = await Promise.all([...]);
    ...
    return byTeam;
  } catch {
    return new Map();
  }
});
```

### SoS compute cost includes 18 weeks x NFL team schedules x DB score rows

`lib/queries/positional-sos.ts:84-142`
```ts
  const scheduleResults = await Promise.all(
    NFL_TEAMS.map(async (team) => ({
      team,
      weeks: await getNflTeamSchedule({ nflTeam: team, season: input.season }),
    })),
  );
  ...
  const weekNumbers = Array.from({ length: 18 }, (_, i) => i + 1);
  const weekRows = await Promise.all(
    weekNumbers.map((week) =>
      loadScoreRows({ season: input.season, week, kind: "stats", position: input.positionId, columns: "pts" })
    ),
  );
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Unit tests | `pnpm test` | exit 0 |

## Scope

**In scope**:
- Add a new exported function from `lib/queries/positional-sos.ts`:
  - `getPositionalSosTableResult(input)` → returns `{ ok: true, table } | { ok: false, error }`.
- Keep the existing `getPositionalSosTable(input)` export as a backwards-compatible wrapper that:
  - calls the result function
  - on `{ok:false}` logs + returns an empty map (preserve current resilience).
- Update roster panels to use the result function, so they can optionally log/display richer fallback behavior.

**Out of scope**:
- Changing the SoS math outputs when there are no errors.
- Adding heavy UI/UX redesign.

## Git workflow

- Branch: `advisor/029-sos-explicit-failure-mode`
- Commit message example: `Make positional SOS failures explicit`
- Do NOT push unless instructed.

## Steps

### Step 1: Introduce an explicit result API

In `lib/queries/positional-sos.ts`:
1. Define a typed error shape, e.g.
   ```ts
   export type PositionalSosTableError = { message: string }
   ```
2. Implement `getPositionalSosTableResult(input)` that:
   - performs the same computation as existing `getPositionalSosTable`
   - but returns `{ ok:false, error }` instead of always returning `new Map()` silently
3. Refactor the internal `try/catch` so the error is captured:
   - preserve the `cache()` behavior
   - but return `{ ok:false, error }` to the outer function

**Important**: keep `getPositionalSosTable` as a wrapper to avoid breaking unknown call sites.

**Verify**:
- `pnpm typecheck`

### Step 2: Update known UI call sites

Update:
- `components/team/panels/my-team-roster.tsx`
- `components/team/panels/my-team-stats.tsx`

to call `getPositionalSosTableResult` instead of `getPositionalSosTable`.

Behavior when `{ok:false}`:
- Keep UI resilient: use an empty map for SOS to avoid crashes.
- Add at least a server-side `console.warn`/logger entry including season + positions count (no secrets).

**Verify**:
- `pnpm lint`
- `pnpm typecheck`

### Step 3: Add a focused unit test for failure-mode plumbing

Because real ESPN/Sleeper failures are nondeterministic, structure the implementation so the inner SoS compute function can accept injected dependencies for tests (an internal seam).

Add a test that:
- Injects a dependency that throws
- Asserts `getPositionalSosTableResult` returns `{ ok:false, error }`

**Verification**:
- `pnpm test`

## Test plan

- One new unit test file under `lib/queries/` (or existing test folder) covering the failure-mode union.

## Done criteria

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test` exits 0
- [ ] `getPositionalSosTable` still never throws for any existing call site semantics
- [ ] `getPositionalSosTableResult` returns typed failure instead of silent empty maps
- [ ] `plans/README.md` status row updated

## STOP conditions

- If SoS call sites are discovered beyond roster/stats panels and have different expectations, STOP and report the list before proceeding.

## Maintenance notes

- This plan improves debuggability; future UI changes should prefer the `Result` function to avoid silent opponent difficulty degradation.

