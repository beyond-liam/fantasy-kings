# Plan 010: Deterministic playoff pairing order

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- lib/leagues/playoffs/ensure-matchups.ts lib/leagues/playoffs/advance.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (safe after 004 if touching the same files)
- **Category**: bug
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

When loading existing playoff rows, `ensure-matchups.ts` has **no `orderBy`**. Winners are mapped in that unordered sequence into `winnersInBracketOrder`, then paired `(0,1), (2,3), …` when re-seed is off (`advance.ts`). Non-deterministic DB order can build the wrong next-round matchups.

## Current state

```ts
// ensure-matchups.ts:69-84 — select playoff matchups, no orderBy
const existingPlayoff = await db.select({...}).from(matchups).where(...);

// later:
const weekRows = existingPlayoff.filter((row) => row.week === week);
const winners = weekRows.map(...).filter(...);
const pairings = nextRoundPairings({
  winnersInBracketOrder: winners,
  ...
});
```

First-round insert order is meaningful (e.g. 8-team `1v8, 4v5, 2v7, 3v6`). Existing tests: `lib/leagues/playoffs/advance.test.ts`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `pnpm test -- lib/leagues/playoffs` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |

## Scope

**In scope**:
- `lib/leagues/playoffs/ensure-matchups.ts`
- Possibly `lib/leagues/playoffs/advance.ts` if ordering helper lives there
- `lib/leagues/playoffs/advance.test.ts` and/or new ensure-matchups tests

**Out of scope**:
- Changing re-seed algorithm
- Finalize week range (004)
- UI bracket display

## Git workflow

- Branch: `advisor/010-deterministic-playoff-pairing`
- Commit message example: `Order playoff matchup rows before advancing brackets.`
- Do NOT push unless instructed.

## Steps

### Step 1: Define stable order

When building `weekRows` for advancement, sort by original bracket sequence. Practical approach:

1. Prefer ordering by seed of `homeTeamId` using `seedByTeamId` already available in the function (lower seed number first), **or**
2. If first-round rows were inserted in bracket order, persist/use an explicit `bracketSlot` if one exists — only if schema already has it (do not invent a migration unless necessary)

If seed map is available for all teams in the week, sort `weekRows` by `Math.min(seed(home), seed(away))` then by home seed. Document the chosen rule in a one-line comment.

Also add `.orderBy(matchups.week, ...)` on the initial select if a stable secondary key exists (e.g. `matchups.id` as last resort only if seeds unavailable — prefer seed-based weekRows sort).

**Verify**: unit test with shuffled input weekRows produces fixed pairings when `reSeedAfterEachRound` is false

### Step 2: Extend tests

Add a test that feeds week finals in reverse order vs forward order and asserts identical `nextRoundPairings` / inserted homes-aways.

**Verify**: `pnpm test -- lib/leagues/playoffs` exit 0

## Test plan

- 4-team and 8-team non-reseed advancement with shuffled row order → stable pairs
- Reseed-on path still matches existing tests

## Done criteria

- [ ] Advancement sorts week rows deterministically before winner pairing
- [ ] Tests prove order independence
- [ ] `pnpm typecheck`, `pnpm test` exit 0
- [ ] `plans/README.md` 010 → DONE

## STOP conditions

- Seed map missing for bye teams / 6-team byes makes ordering ambiguous — stop with the scenario rather than guessing
- Existing advance tests fail for reasons unrelated to ordering

## Maintenance notes

- Reviewer: confirm 6-team bye injection still places seeds 1–2 correctly
- Fix may change brackets only where prior runs were already wrong — acceptable
