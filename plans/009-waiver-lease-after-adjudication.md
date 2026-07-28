# Plan 009: Stamp waiver processed-at only after adjudication

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- lib/leagues/waivers/process.ts lib/leagues/waivers/calendar.ts db/schema/`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

Waiver processing takes a season-level lease by setting `lastWaiverProcessedAt = now` **before** loading/applying claims (`process.ts:88-106`). `isWaiverProcessDue` treats any `lastWaiverProcessedAt >= processInstant` as done (`calendar.ts:175-180`), and the due window is only ~60 minutes. A crash after the lease but before adjudication leaves claims unprocessed until the next process day — FAAB/priority outcomes miss the run.

## Current state

```ts
// process.ts lease
const [leased] = await db.update(leagueSeasons)
  .set({ lastWaiverProcessedAt: now })
  .where(and(
    eq(leagueSeasons.id, season.id),
    or(isNull(leagueSeasons.lastWaiverProcessedAt), lt(..., processInstant)),
  ))
  .returning(...);
```

There is a second stamp after work (~469-472) but the early stamp already closes the window.

Existing dbtests: `lib/leagues/waivers/process.dbtest.ts` — extend these; do not rewrite the whole suite.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| DB tests | `pnpm test:db -- lib/leagues/waivers` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |

## Scope

**In scope**:
- `lib/leagues/waivers/process.ts`
- `lib/leagues/waivers/calendar.ts` only if due-check must understand a new lease column
- Schema/migration if a separate `waiverProcessingStartedAt` / `waiverLeaseUntil` column is chosen
- `lib/leagues/waivers/process.dbtest.ts`

**Out of scope**:
- Changing FAAB vs rolling priority rules
- Cron schedule changes
- Plan 006 lineup work

## Git workflow

- Branch: `advisor/009-waiver-lease-after-adjudication`
- Commit message example: `Keep waiver process due until claims finish adjudicating.`
- Do NOT push unless instructed.

## Steps

### Step 1: Choose lease strategy (implement one)

**Preferred (minimal schema):** use a dedicated nullable timestamp column `waiverProcessingLeaseUntil` (or `lastWaiverProcessingStartedAt`) for concurrency, and set `lastWaiverProcessedAt` **only** after successful adjudication (or on intentional empty-run completion).

**Alternative:** CAS on a `processing` flag. Avoid double-award.

Lease rules:
1. Concurrent second runner must not adjudicate the same claims
2. If a runner dies mid-flight, another runner may retry within the same process window (or shortly after) — do not permanently close the window on start
3. Successful completion sets `lastWaiverProcessedAt` to a time ≥ `processInstant`

If schema change is required: add column via Drizzle schema + `pnpm db:generate`.

**Verify**: migration generates cleanly; typecheck passes

### Step 2: Implement process.ts

- Acquire lease without setting `lastWaiverProcessedAt`
- On success (including zero claims to process): set `lastWaiverProcessedAt`
- On thrown error: clear lease / do not set `lastWaiverProcessedAt`; rethrow or return failure so cron can retry
- Keep `force` path behavior coherent with tests

**Verify**: extend `process.dbtest.ts`

### Step 3: Tests

Add/adjust dbtests:

1. Successful run sets `lastWaiverProcessedAt` and awards claims (existing)
2. **New:** simulate failure after lease acquisition (inject throw or force error path) → `lastWaiverProcessedAt` still before processInstant / null → `isWaiverProcessDue` still true inside grace window
3. Concurrent second call while lease held → no double award

**Verify**: `pnpm test:db -- lib/leagues/waivers` exit 0

## Test plan

Model after existing process.dbtest patterns. Do not hit real cron.

## Done criteria

- [ ] `lastWaiverProcessedAt` is not set before claims are adjudicated (except documenting any intentional empty-success stamp **after** work)
- [ ] Crash mid-run leaves the process still due within the window
- [ ] No double-award under concurrent lease
- [ ] `pnpm typecheck`, `pnpm test:db` exit 0
- [ ] `plans/README.md` 009 → DONE

## STOP conditions

- Lease design would require Redis/external lock — stop; stay on Postgres columns
- Existing characterization tests encode early-stamp as required behavior — update them and note in the PR, do not silently keep the bug

## Maintenance notes

- Reviewer: pay attention to `force: true` manual runs from commissioner actions
- Hourly cron + 60m grace must still allow one successful retry after a failed attempt
