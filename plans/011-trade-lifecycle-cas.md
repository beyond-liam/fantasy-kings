# Plan 011: Guard every trade status transition with compare-and-set and execute before marking complete

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e1e7f1e..HEAD -- lib/leagues/trades/execute.ts lib/leagues/trades/lifecycle.ts lib/actions/trades.ts lib/cron/process-trades.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches trade completion, veto, and the cron path)
- **Depends on**: plans/009-db-characterization-tests.md
- **Category**: bug
- **Planned at**: commit `e1e7f1e`, 2026-07-23

## Why this matters

Trade status transitions are all unconditional `UPDATE trades SET status = ... WHERE id = ?`, and instant-accept marks a trade `completed` **before** the roster moves run. Consequences, all reachable today:

- **Veto vs. cron race**: the cron completes expired-review trades (`lib/cron/process-trades.ts`) while a member vetoes; both write unguarded — a vetoed trade can end up `completed` with rosters swapped, or a completed trade flipped to `vetoed` with rosters already swapped.
- **Stuck "completed" trades**: instant-processing accept sets `status: "completed"` first; if `executeTrade` then fails (player no longer available → `invalidated` path, or a thrown error), the trade shows completed with `completedAt` null and no roster moves — and the cron only retries `status = 'review'` rows, so nothing ever heals it.
- **Accept/reject/cancel last-write-wins**: concurrent accept + reject on the same pending trade both succeed; the final status is whichever wrote last.
- **No capacity re-check at execute**: a trade legal at accept can complete 24h later over roster/position max (rosters change during the review window via free agency and waivers).

The fix: `executeTrade` *claims* the trade with a conditional update inside its transaction (0 rows updated = someone else resolved it), every lifecycle transition adds a status guard to its `WHERE`, accept never pre-writes `completed`, and execute re-validates capacity. Plan 009 pinned the buggy accept-before-execute behavior with a marker `CHARACTERIZATION OF KNOWN BUG — plan 011 flips this`.

## Current state

Trade statuses (see `lib/leagues/trades/status.ts:5-28` and `guards.ts`): `pending`, `review`, `awaiting_commissioner`, `completed`, `rejected`, `cancelled`, `commissioner_rejected`, `vetoed`, `invalidated`. `resolveNextStatusOnAccept` (status.ts:41-51) maps league `tradeProcessing` → `"completed"` (instant) | `"awaiting_commissioner"` | `"review"`.

### (a) `executeTrade` — `lib/leagues/trades/execute.ts:60-235`

- Lines 65–95: reads `trade_players` rows and the trade, then checks **outside any transaction**: idempotent success if `completedAt` set (84–86); rejects unless status is one of `pending|review|awaiting_commissioner|completed` (88–95). Note `completed` is currently allowed in — that exists only to serve the accept-marks-completed-first flow this plan removes.
- Lines 114–166: loads roster rows for all trade players, checks availability; if unavailable → unconditional `UPDATE ... SET status = 'invalidated' WHERE id = ?` + activity, returns error.
- Lines 170–232: `db.transaction` — waives/deletes drops, swaps `rosterPlayers.teamId` for offers, then:

```ts
// execute.ts:217-224 — unconditional completion
await tx
  .update(trades)
  .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
  .where(eq(trades.id, input.tradeId));
```

then `invalidateConflictingTrades` (14–57), which invalidates other OPEN trades sharing a player — keep this.

### (b) `acceptTradeOffer` — `lib/leagues/trades/lifecycle.ts:194-282`

```ts
// lifecycle.ts:207-236 (abridged)
if (input.receivingDropIds.length > 0) {
  await db.insert(tradePlayers).values(...isDrop rows...);
}
await db.update(trades).set({
  status: input.nextStatus,          // ← "completed" for instant leagues, BEFORE execute
  counterpartyAcceptedAt: new Date(),
  reviewEndsAt: input.reviewEndsAt,
  updatedAt: new Date(),
}).where(eq(trades.id, input.tradeId));   // ← no status guard

if (input.nextStatus === "completed") {
  const result = await executeTrade({...});
  if (!result.success) return { ok: false, error: result.error };
  await logTradeActivity({... "trade_completed" ...});
}
```

The action layer (`lib/actions/trades.ts`, accept path around lines 413–466) checks `status === "pending"` and validates roster capacity **before** calling this — a check-then-act with no guard at the write.

### (c) Unguarded transitions in `lifecycle.ts`

- `rejectTradeOffer` (284–316): `SET status = 'rejected' WHERE id = ?`
- `cancelTradeOffer` (318–350): `SET status = 'cancelled' WHERE id = ?`
- `rejectTradeByCommissioner` (398–436): `SET status = 'commissioner_rejected' WHERE id = ?`
- `castTradeVeto` (439–487): inserts the veto vote, counts votes, and on threshold: `SET status = 'vetoed' WHERE id = ?` (462–465) — can veto an already-completed trade.
- `approveTradeByCommissioner` (352–396): calls `executeTrade` directly (safe once execute has CAS).
- `completeExpiredTrade` (42–96): called by the cron for every `status = 'review'` row with `reviewEndsAt <= now()` (`getExpiredReviewTrades`, `lib/queries/trades.ts:359-375`); calls `executeTrade` with no claim — two overlapping cron ticks both attempt the same trade.

### (d) Capacity validation exists only at accept time

`lib/actions/trades.ts` (~451–466) validates roster capacity when accepting. Nothing re-validates at execute time. Reusable pieces: `getMaxRosterSize`, `getPositionRosterMax`, `countActiveRosterPlayers`, `countActivePositionPlayers` from `lib/leagues/roster-capacity.ts` (see how `lib/leagues/waivers/process.ts:489-510` uses them); `lib/leagues/trades/validate.ts` has the accept-time validator (read it before Step 3 and reuse its counting rules — offers in minus offers out per team, drops excluded).

### (e) Characterization contract from plan 009

`lib/leagues/trades/lifecycle.dbtest.ts` has a test marked `// CHARACTERIZATION OF KNOWN BUG — plan 011 flips this: status must not be completed when execute fails.`

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0              |
| Pure tests| `pnpm test`      | 0 fail              |
| DB tests  | `pnpm test:db`   | 0 fail              |
| Lint      | `pnpm lint`      | 0 errors            |

## Scope

**In scope** (the only files you should modify):
- `lib/leagues/trades/execute.ts`
- `lib/leagues/trades/lifecycle.ts`
- `lib/actions/trades.ts` (only if a call-site signature/return needs threading; keep changes minimal)
- `lib/leagues/trades/lifecycle.dbtest.ts` (flip characterization, add race tests)

**Out of scope** (do NOT touch):
- `lib/cron/process-trades.ts` — with executeTrade CAS in place, the cron loop is safe as-is (a lost race returns a non-success result for that trade; acceptable).
- `lib/leagues/trades/validate.ts`, `vetoes.ts`, `guards.ts` logic (read-only reuse).
- Notification/alert wiring (`notifyUsers` / `announceTrade*` call sites) — keep exactly as-is; the League Alert migration is a separate direction item.
- `lib/queries/trades.ts`.

## Git workflow

- Branch: `advisor/011-trade-lifecycle-cas`
- Commit per step; message style: single imperative sentence with a period.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Give `executeTrade` an atomic claim

Restructure `executeTrade` so the transaction **starts by claiming the trade**:

```ts
await db.transaction(async (tx) => {
  const [claimed] = await tx
    .update(trades)
    .set({ status: "completed", completedAt: acquiredAt, updatedAt: new Date() })
    .where(
      and(
        eq(trades.id, input.tradeId),
        inArray(trades.status, ["pending", "review", "awaiting_commissioner"]),
        isNull(trades.completedAt),
      ),
    )
    .returning({ id: trades.id });
  if (!claimed) {
    throw new TradeClaimConflict();   // local sentinel class; caught below
  }
  // ...existing drop/offer moves...
  // ...invalidateConflictingTrades (unchanged)...
});
```

Details:
- Remove `"completed"` from the allowed-status set — after Step 2, nothing marks a trade completed before execute, so an already-`completed` status means someone else won the race.
- Keep the pre-transaction reads (trade rows, roster rows, availability check) for cheap early-outs, including the idempotent `completedAt` success at line 84 — but the claim inside the transaction is now the source of truth.
- Move the roster **moves** after the claim; the availability data read before the transaction is fine to reuse (the claim guarantees only one executor proceeds; roster rows for these players can only be changed by another trade, which the claim + `invalidateConflictingTrades` ordering already fences at the status level).
- Catch the sentinel outside the transaction and return `{ success: false, error: "Trade was already resolved.", conflict: true }` — or `{ success: true }` if a re-read shows `completedAt` set (idempotent completion for cron double-fire).
- The unavailable-players `invalidated` write (lines 150–153) gets a guard too: `and(eq(trades.id, ...), inArray(trades.status, [...OPEN_TRADE_STATUSES]))`.

**Verify**: `pnpm typecheck` → exit 0. `pnpm test:db` — happy-path execute tests still pass; the idempotency test (execute twice → success) still passes.

### Step 2: Stop pre-writing `completed` in `acceptTradeOffer`

In `lifecycle.ts:207-244`:

1. Replace the unconditional status update with a **guarded claim of the accept itself**:

```ts
const [accepted] = await db
  .update(trades)
  .set({
    status: input.nextStatus === "completed" ? "awaiting_commissioner" /* NO — see below */ : input.nextStatus,
    ...
  })
```

   — Do **not** invent an intermediate status. Correct shape: for `review`/`awaiting_commissioner`, keep setting that status but add the guard `and(eq(trades.id, input.tradeId), eq(trades.status, "pending"))` with `.returning()`; 0 rows → `return { ok: false, error: "Trade was already resolved." }`. For `completed` (instant processing), **skip the status update entirely** — leave the trade `pending` and let `executeTrade`'s claim (Step 1 allows `pending`) transition it straight to `completed`. Set `counterpartyAcceptedAt`/`updatedAt` in that path via the same guarded update but with `status` untouched:

```ts
// instant path: record acceptance without changing status
const [accepted] = await db.update(trades)
  .set({ counterpartyAcceptedAt: new Date(), updatedAt: new Date() })
  .where(and(eq(trades.id, input.tradeId), eq(trades.status, "pending")))
  .returning({ id: trades.id });
if (!accepted) return { ok: false, error: "Trade was already resolved." };
```

2. Insert the `receivingDropIds` rows **after** the guarded accept succeeds (they're currently inserted before any check). If the instant-path `executeTrade` then fails, delete those just-inserted drop rows before returning the error, so a retried accept doesn't duplicate them:

```ts
if (!result.success) {
  if (input.receivingDropIds.length > 0) {
    await db.delete(tradePlayers).where(and(
      eq(tradePlayers.tradeId, input.tradeId),
      eq(tradePlayers.teamId, input.actor.teamId),
      eq(tradePlayers.isDrop, true),
      inArray(tradePlayers.playerId, input.receivingDropIds),
    ));
  }
  return { ok: false, error: result.error };
}
```

3. The rest (activity, `announceTradeAcceptedReview`/`notifyUsers`) is unchanged.

**Verify**: `pnpm test:db` — the plan-009 KNOWN BUG test now fails (expected; flipped in Step 5). Accept→review test still passes.

### Step 3: Re-validate capacity inside execute

In `executeTrade`, after the roster rows are loaded (line ~129) and before the transaction: compute post-trade roster counts for both teams and reject over-capacity completions.

- Read `lib/leagues/trades/validate.ts` first and mirror its counting semantics (which players count toward the max, how drops offset). Inputs you already have: `proposingOffers/receivingOffers/proposingDrops/receivingDrops` and each player's `primaryPositionId` from `rosterRows`.
- You need each team's current roster and the season's slot settings — the caller has the season; extend `executeTrade`'s input with `{ leagueSeasonId is already on trade; add settings: LeagueSeasonSettings, benchSlots: number }` threaded from the three callers (`lifecycle.ts` accept/approve/completeExpired paths — each already holds season settings or can receive them from `lib/actions/trades.ts` / `lib/cron/process-trades.ts`, both of which load `leagueSeasons.settings` today).
- On violation: guarded `invalidated` update (same as the unavailable-players path) + `logTradeActivity` with summary `"Trade invalidated — a roster would exceed its size limits."`, return `{ success: false, error: ..., invalidated: true }`.

If threading settings through all call sites balloons (more than the three expected callers), STOP and report instead of widening the signature further.

**Verify**: `pnpm typecheck` → exit 0; all existing dbtests pass.

### Step 4: Guard the remaining transitions

Add status guards + `.returning()` + 0-row conflict handling:

| Function | Guard (allowed prior status) | 0-row result |
|---|---|---|
| `rejectTradeOffer` | `pending` | `{ ok: false, error: "Trade was already resolved." }` |
| `cancelTradeOffer` | `pending` | same |
| `rejectTradeByCommissioner` | `awaiting_commissioner` | same |
| `castTradeVeto` threshold write | `review` | skip the vetoed activity/announce (votes recorded, but the trade was resolved first) |
| `commitTradeProposal` counter-reject (lifecycle.ts:165-168) | `pending` | proceed silently (countered trade already resolved — the new proposal stands) |

On a 0-row conflict, return **before** the activity log and notifications for that transition (no `trade_rejected` activity for a reject that lost the race).

Then check `lib/actions/trades.ts` call sites still compile and surface the new conflict errors to the UI as ordinary error strings (they already render `{ success: false, error }`).

**Verify**: `pnpm typecheck` → exit 0; `pnpm lint` → 0 errors.

### Step 5: Flip the characterization and add race tests

In `lib/leagues/trades/lifecycle.dbtest.ts`:

- **Flip** the KNOWN BUG test: instant-accept where execute fails (offered player made unavailable) now asserts the trade is **not** `completed` — it is `pending` (or `invalidated` if the unavailability path fired), `completedAt` is null, rosters unchanged, and the inserted drop rows were cleaned up. Remove the marker comment.
- **Veto-then-execute**: veto a `review` trade to threshold, then call `executeTrade` → `success: false`, status stays `vetoed`, rosters unchanged.
- **Execute-then-veto**: complete a `review` trade via `executeTrade`, then drive `castTradeVeto` to threshold → status stays `completed`, no `trade_vetoed` activity row.
- **Double execute (cron overlap)**: two sequential `executeTrade` calls → exactly one set of roster moves; second returns without error (idempotent) or with a conflict result — assert rosters moved exactly once and exactly one `completedAt`.
- **Concurrent accept/reject**: `acceptTradeOffer` (review) then `rejectTradeOffer` → reject returns the conflict error, status stays `review`.
- **Capacity at execute**: build a review trade that is 2-for-1; before executing, fill the receiving team to max roster via seed rows → `executeTrade` → `invalidated`, rosters unchanged.

**Verify**: `pnpm test:db` → 0 fail; `grep -rn "plan 011 flips" lib` → no matches. `pnpm test`, `pnpm typecheck`, `pnpm lint` green.

## Test plan

Covered by Step 5 (six cases in `lifecycle.dbtest.ts`, pattern from plan 009). Verification: `pnpm test:db` → all pass.

## Done criteria

- [ ] Every `trades` status `UPDATE` in `execute.ts`/`lifecycle.ts` carries a prior-status guard (`grep -n "update(trades)" lib/leagues/trades/*.ts` and inspect each — none may be `WHERE id` only)
- [ ] No code path sets `status: "completed"` outside `executeTrade`'s claimed transaction
- [ ] `executeTrade` invalidates over-capacity completions
- [ ] Plan-003 KNOWN BUG characterization flipped; the six race tests pass
- [ ] `pnpm test`, `pnpm test:db`, `pnpm typecheck`, `pnpm lint`, `pnpm build` all exit 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 009 is not DONE.
- Drizzle's `.returning()` on `update` misbehaves under the PGlite harness (it shouldn't — PGlite is real Postgres — but if row counts come back wrong, report).
- Threading season settings into `executeTrade` (Step 3) requires touching more than `lifecycle.ts`, `lib/actions/trades.ts`, and `lib/cron/process-trades.ts`.
- You find a UI flow that depends on accept-instant showing `completed` before rosters move (search `components/trades/` for status handling) — report the flow before changing UI expectations.
- The `castTradeVeto` guard breaks the veto-progress UI (`getTradeVetoSummaries`) — votes must still be recordable while `review`; only the terminal flip is guarded.

## Maintenance notes

- The invariant to protect in review: **`completed` is written exactly once, inside `executeTrade`'s transaction, guarded by prior status** — any future "force complete" admin feature must go through `executeTrade`.
- The cron (`processAllReadyTrades`) now tolerates overlap; if a lease is ever added (audit finding CORRECTNESS-06's sibling), it's an optimization, not a correctness requirement.
- Deferred deliberately: migrating the remaining `notifyUsers` trade notifications to League Alert announce helpers (direction finding), and any retry/heal job for trades stuck by transient execute errors — with this plan they remain `pending`/`review` and are retryable by design.
