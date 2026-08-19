# Plan 027: Extract shared roster-minimum enforcement for waiver drops/adds

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the “STOP conditions” section occurs, stop and report — do
> not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f78943f..HEAD -- lib/actions/waivers.ts lib/leagues/waivers/process.ts lib/leagues/waivers/process.dbtest.ts`
> If any in-scope file changed since this plan was written, compare the “Current state” excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `f78943f`, 2026-08-19

## Why this matters

Waiver claim UX (server action layer) and waiver processing (domain layer) both enforce “roster minimums would be breached by the drop/add” when a drop is required.

That logic is duplicated with subtly different error fallback strings, which increases drift risk and hurts locality: fixes must be applied in multiple places.

## Current state

### Action layer validates roster-minimum breach on claim submission

`lib/actions/waivers.ts:433-468`
```ts
    const rules = resolveTransactionRules(season.settings.transactionRules);
    if (
      rules.enforceRosterMinimums &&
      wouldBreachRosterMinimums({
        roster: rosteredOnTeam,
        removeIds: [dropPlayerId],
        add: [{ id: player.id, primaryPositionId: player.primaryPositionId, slotPositionId: null }],
        rosterSlots: season.settings.rosterSlots,
        enforce: true,
      })
    ) {
      return {
        success: false,
        error:
          firstRosterMinimumError(
            simulateRosterAfterMutation({ roster: rosteredOnTeam, removeIds: [dropPlayerId], add: [{ id: player.id, primaryPositionId: player.primaryPositionId, slotPositionId: null }] }),
            season.settings.rosterSlots,
            true,
          ) ?? "That drop would leave you under a roster minimum.",
      };
    }
```

### Domain layer validates roster-minimum breach during adjudication application

`lib/leagues/waivers/process.ts:692-723`
```ts
    const rules = resolveTransactionRules(season.settings.transactionRules);
    if (
      wouldBreachRosterMinimums({
        roster: rosteredOnTeam,
        removeIds: [claim.dropPlayerId],
        add: [{ id: player.id, primaryPositionId: player.primaryPositionId, slotPositionId: null }],
        rosterSlots: season.settings.rosterSlots,
        enforce: rules.enforceRosterMinimums,
      })
    ) {
      return {
        error:
          firstRosterMinimumError(
            [ ...rosteredOnTeam.filter((row) => row.id !== claim.dropPlayerId), { id: player.id, primaryPositionId: player.primaryPositionId, slotPositionId: null }, ],
            season.settings.rosterSlots,
            true,
          ) ?? "Drop would leave the roster under a position minimum.",
      };
    }
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Unit tests | `pnpm test` | exit 0 |
| DB tests | `pnpm test:db` | exit 0 |

## Scope

**In scope**:
- Create a shared deep module under `lib/leagues/waivers/` that evaluates roster-minimum breach for a waiver drop/add pair and returns a typed error (or ok).
- Refactor `lib/actions/waivers.ts` and `lib/leagues/waivers/process.ts` to call that shared module.
- Add/extend tests to ensure the action/domain paths remain behaviorally consistent.

**Out of scope**:
- Any logic outside “roster-minimum would be breached by this drop/add combination”.
- Changing waiver processing adjudication outcomes.

## Git workflow

- Branch: `advisor/027-waiver-roster-minimums-shared-module`
- Commit message example: `Share roster minimum breach logic for waivers`
- Do NOT push unless instructed.

## Steps

### Step 1: Create a shared waiver-minimum evaluator module

Create a new file under `lib/leagues/waivers/` (name is up to you; match repo conventions) exporting a function with an interface along the lines of:

- Input:
  - `seasonSettings` (or `transactionRules + rosterSlots`) needed for `resolveTransactionRules` and `season.settings.rosterSlots`
  - `rosteredOnTeam` array (same element shape used in current code paths)
  - `dropPlayerId`
  - `incomingPlayer` fields: `id`, `primaryPositionId`
  - `fallbackError` string for the caller to preserve existing UX/domain wording
- Output:
  - `{ ok: true }` or `{ ok: false, error: string }`

The implementation must move the duplicated logic based on:
- `resolveTransactionRules(season.settings.transactionRules)`
- `wouldBreachRosterMinimums`
- `simulateRosterAfterMutation` / `firstRosterMinimumError` (choose one approach; ensure behavior matches existing fallbacks)

**Verify**:
- `pnpm typecheck`

### Step 2: Refactor action-layer code to use the shared evaluator

In `lib/actions/waivers.ts`, replace the inline `rules.enforceRosterMinimums && wouldBreachRosterMinimums(...)` block in `fileWaiverClaim` with a call to the shared module.

Ensure the same fallback string as the current code is preserved:
- `"That drop would leave you under a roster minimum."`

**Verify**:
- `pnpm lint`
- `pnpm typecheck`

### Step 3: Refactor domain-layer code to use the shared evaluator

In `lib/leagues/waivers/process.ts` inside `applyAwardedClaim`, replace the duplicated `wouldBreachRosterMinimums`/`firstRosterMinimumError` block with the shared call.

Ensure the same fallback string is preserved:
- `"Drop would leave the roster under a position minimum."`

**Verify**:
- `pnpm test:db` (behavior must not change)

### Step 4: Add a focused regression test for the shared evaluator

Add a test file in `lib/leagues/waivers/` that:
- seeds/constructs a roster state with a specific minimum breach scenario
- calls the shared module and asserts the returned error message matches the expected fallback (or non-fallback value if deterministic)

If constructing the roster state directly is too hard, write the test as an integration-style DB test using the existing harness patterns from `lib/leagues/waivers/process.dbtest.ts`, but assert on the shared evaluator directly (import it) rather than only via `processSeasonWaivers`.

**Verification**:
- `pnpm test`
- `pnpm test:db`

## Test plan

- Rely primarily on `lib/leagues/waivers/process.dbtest.ts` to catch domain behavior drift.
- Add one new test for the shared evaluator to prevent future drift.

## Done criteria

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test` exits 0
- [ ] `pnpm test:db` exits 0
- [ ] No new waiver minimum logic remains duplicated in both places (only one shared implementation)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any regression in waiver adjudication behavior (tests failing or DB results change).
- The shared evaluator can’t reproduce existing error fallback behavior with deterministic inputs.

## Maintenance notes

- If roster-minimum evaluation rules evolve, there should be a single update location (the shared module).
- Reviewers should scrutinize the exact error fallback wording to avoid surprising UX changes.

