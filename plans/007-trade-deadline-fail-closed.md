# Plan 007: Fail closed on trade deadline when NFL state is unavailable

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- lib/actions/trades.ts lib/sleeper/api.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

`assertCanPropose` in `lib/actions/trades.ts` defaults NFL week to `1` when `getNflState()` fails. That makes `isTradeDeadlinePassed` almost never true during an outage, so managers can propose trades after the deadline. Fail closed: refuse proposes when week cannot be determined.

## Current state

```ts
// lib/actions/trades.ts:76-79
const nflState = await getNflState().catch(() => ({ week: 1 }));
const currentWeek = Math.max(1, Number(nflState.week) || 1);
if (isTradeDeadlinePassed(currentWeek, season.tradeDeadlineWeek)) {
  return tradeDeadlineError(season.tradeDeadlineWeek!);
}
```

Error helpers for trades already return user-facing strings elsewhere in the file — match that style.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test` | exit 0 (add unit test if deadline helpers are pure) |

## Scope

**In scope**:
- `lib/actions/trades.ts` — `assertCanPropose` (and any duplicate deadline checks that use the same week-1 fallback; grep `catch(() => ({ week: 1 }))`)
- Optional small pure helper + unit test if extraction is clean
- Do **not** add timeouts to Sleeper in this plan (covered by perf plan 012's sibling — actually timeouts are plan for sleeper in 011/012 area; leave timeouts out unless already present)

**Out of scope**:
- Changing deadline settings UX
- Accept/execute/veto paths unless they also use the week-1 fallback for deadline (if they do, fix those the same way)

## Git workflow

- Branch: `advisor/007-trade-deadline-fail-closed`
- Commit message example: `Fail closed on trade proposes when NFL week cannot be loaded.`
- Do NOT push unless instructed.

## Steps

### Step 1: Grep for the antipattern

Run: `rg -n "week: 1" lib/actions/trades.ts lib/leagues/trades lib/sleeper`

Fix every trade-deadline-related fail-open default found.

### Step 2: Fail closed

```ts
let nflState: SleeperNflState;
try {
  nflState = await getNflState();
} catch {
  return "Could not verify the NFL week for the trade deadline. Try again shortly.";
}
const currentWeek = Math.max(1, Number(nflState.week) || 0);
if (!Number.isFinite(currentWeek) || currentWeek < 1) {
  return "Could not verify the NFL week for the trade deadline. Try again shortly.";
}
```

If `tradeDeadlineWeek` is null, existing `isTradeDeadlinePassed` behavior should remain (no deadline).

**Verify**: `pnpm typecheck`; manually confirm proposeTrade surfaces the string on failure path

### Step 3: Unit test the deadline gate if extracted

If you extract `assertTradeDeadlineAllowsPropose({ currentWeek, tradeDeadlineWeek })`, test passed/not-passed. The fetch failure path can stay in the action without a network test.

**Verify**: `pnpm test` exit 0

## Test plan

- Pure deadline helper cases if extracted
- No live Sleeper calls in CI

## Done criteria

- [ ] No `catch(() => ({ week: 1 }))` on trade deadline paths
- [ ] Outage returns a clear user error instead of allowing late proposes
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` exit 0
- [ ] `plans/README.md` 007 → DONE

## STOP conditions

- Another feature depends on week defaulting to 1 for non-deadline reasons in the same function — disentangle carefully or STOP
- `getNflState` never throws but returns garbage — still validate `week`

## Maintenance notes

- Acceptable UX: proposes blocked during Sleeper outages
- Optional follow-up: persist last-known NFL week from cron for soft fallback (out of scope)
