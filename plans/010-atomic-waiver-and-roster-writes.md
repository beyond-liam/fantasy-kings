# Plan 010: Make waiver awards and cut-and-add atomic — a failed transaction never loses a player

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e1e7f1e..HEAD -- lib/leagues/waivers/process.ts lib/leagues/roster-writes.ts lib/actions/roster.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (Plan 009 adds test files but must
> not have changed these three modules' behavior.)

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW-MED (transaction wrapping; behavior on the happy path is unchanged)
- **Depends on**: plans/009-db-characterization-tests.md (harness + characterization to flip)
- **Category**: bug
- **Planned at**: commit `e1e7f1e`, 2026-07-23

## Why this matters

Two roster mutations can permanently lose a manager a player when a multi-step write fails halfway:

1. **Waiver award** (`applyAwardedClaim` in `lib/leagues/waivers/process.ts`): the required drop is committed to the DB *before* the roster-full/position-max checks run and before the add is attempted. If any of those fail (or the add's insert conflicts), the claim is marked `failed` but the dropped player is already waived/deleted — the manager is down a player and got nothing.
2. **Cut-and-add** (`cutAndAddPlayer` in `lib/actions/roster.ts`): implemented as two independent server-action calls — the cut commits, then the add runs its own checks and can fail (the code even ships the apology string "Player was cut, but the add failed. Try adding again."). On a contested free agent this is a live race, not a theoretical one.

Plan 009 pinned the buggy behavior with a test marked `CHARACTERIZATION OF KNOWN BUG — plan 010 flips this`. This plan reorders validation before any write and wraps the writes in one transaction, then flips that assertion.

## Current state

### (a) `applyAwardedClaim` — `lib/leagues/waivers/process.ts:434-533`

Order of operations today:

```ts
// process.ts:445-487 (abridged)
const seasonRows = await findSeasonRosterRows(season.id, claim.playerId);
if (seasonRows.some((row) => row.status === "rostered")) {
  return "Player was already claimed or rostered by another team.";
}
const irLock = await assertIrAcquisitionsAllowed(claim.teamId, ...);
if (irLock) return irLock.error;
const [player] = await db.select(...).from(players)...;
if (!player) return "Player not found.";

let rosteredOnTeam = await listRosteredPlayers(claim.teamId);

if (claim.dropPlayerId) {
  const dropRow = rosteredOnTeam.find((row) => row.id === claim.dropPlayerId);
  if (!dropRow) return "Required drop is no longer on the roster.";
  await waiveOrDeleteRosterRow({ rowId: dropRow.rosterRowId, ... });   // ← WRITE
  rosteredOnTeam = rosteredOnTeam.filter((row) => row.id !== claim.dropPlayerId);
}

// ↓ checks AFTER the write — can return an error string with the drop already committed
const maxRoster = getMaxRosterSize(...);
if (countActiveRosterPlayers(rosteredOnTeam) >= maxRoster) {
  return "Roster is full after processing this claim.";
}
// position-max check, same shape (lines 497-510)

await insertOrRestoreRosteredPlayer({ ... });                          // ← WRITE (own transaction)
return null;
```

Key observation: the capacity checks operate on the **in-memory filtered array** (`rosteredOnTeam` minus the drop), not on the physical DB state — so they can run *before* the physical drop with identical results. That makes the fix a reorder + transaction, not a redesign.

The caller (`processSeasonWaivers`, lines 278–343) treats a non-null return as failure (marks the claim `failed`) and on null marks it `awarded` and debits FAAB (lines 385–397) — both as separate `db.update` calls after `applyAwardedClaim` returns.

### (b) Roster write helpers — `lib/leagues/roster-writes.ts`

- `waiveOrDeleteRosterRow(input)` (lines 119–143): deletes the row, or sets `status: "waived"` + `waiverClearsAt`. Uses the module-level `db`.
- `insertOrRestoreRosteredPlayer(input)` (lines 68–116): opens its own `db.transaction` — deletes expired waived rows for the player season-wide, then restores this team's waived row or inserts a fresh `rostered` row. Uses the module-level `db`.
- Both are also called from `lib/actions/roster.ts`, `lib/actions/waivers.ts`, and `lib/leagues/trades/execute.ts`-adjacent paths — changing their signatures must stay backward compatible (optional client param).

### (c) `cutAndAddPlayer` — `lib/actions/roster.ts:254-286`

```ts
export async function cutAndAddPlayer(slug, cutPlayerId, addPlayerId) {
  ...
  const cutResult = await cutPlayerFromRoster(slug, cutPlayerId);   // commits the cut
  if (!cutResult.success) return cutResult;
  const addResult = await addPlayerToRoster(slug, addPlayerId);     // can fail after
  if (!addResult.success) {
    return { ...addResult, error: addResult.error ?? "Player was cut, but the add failed. Try adding again." };
  }
  ...
}
```

- `cutPlayerFromRoster` (lines 288–355): loads context, finds the rostered row, runs the churn-prevention check (`resolveChurnCut`), then `waiveOrDeleteRosterRow` + activity log.
- `addPlayerToRoster` (lines ~60–252): loads context, checks availability (`getAcquisitionKind`, waiver pool, game-started lock via ESPN scoreboard), roster/position caps, then `insertOrRestoreRosteredPlayer` + activity log.
- Repo conventions: server actions return `{ success: boolean, error?: string, ... }` result objects; domain helpers in `lib/leagues/` return error strings or `{ error }` objects. Drizzle transactions: `db.transaction(async (tx) => { ... })`; nested `tx.transaction` creates a savepoint (used pattern is fine).

### (d) Characterization contract from plan 009

`lib/leagues/waivers/process.dbtest.ts` contains a test marked `// CHARACTERIZATION OF KNOWN BUG — plan 010 flips this: a failed claim must leave the roster untouched.` asserting that a position-max failure after the drop leaves the dropped player gone. This plan must flip that assertion.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0              |
| Pure tests| `pnpm test`      | 0 fail              |
| DB tests  | `pnpm test:db`   | 0 fail              |
| Lint      | `pnpm lint`      | 0 errors            |

## Scope

**In scope** (the only files you should modify):
- `lib/leagues/roster-writes.ts` (add optional transaction-client param to two helpers)
- `lib/leagues/waivers/process.ts` (reorder `applyAwardedClaim` + wrap writes)
- `lib/actions/roster.ts` (make `cutAndAddPlayer` atomic)
- `lib/leagues/waivers/process.dbtest.ts` (flip the characterization; add rollback tests)
- `lib/actions/roster.dbtest.ts` or extend an existing dbtest (cut-and-add rollback test — see Test plan)

**Out of scope** (do NOT touch):
- `lib/leagues/trades/*` — trade atomicity is plan 011.
- The adjudication logic (`lib/leagues/waivers/adjudicate.ts`) — pure, tested, correct.
- Claim-status/FAAB writes in the `processSeasonWaivers` outcome loop beyond what Step 2 specifies.
- `addPlayerToRoster` / `cutPlayerFromRoster` public behavior when called individually.
- Waiver cron lease / overlapping-run protection (separate finding, not selected).

## Git workflow

- Branch: `advisor/010-atomic-waiver-roster-writes`
- Commit per step; message style: single imperative sentence with a period.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Thread an optional client through the two roster-write helpers

In `lib/leagues/roster-writes.ts`, define near the top:

```ts
import type { db } from "@/lib/db";

/** Query surface shared by the root db and a transaction client. */
export type DbClient = Pick<
  typeof db,
  "select" | "insert" | "update" | "delete" | "transaction"
>;
```

(Precedent for this shape: `lib/leagues/trades/execute.ts:19` already uses `tx: Pick<typeof db, "select" | "update" | "insert">`.)

- `waiveOrDeleteRosterRow(input)` → add optional `client?: DbClient` to the input object; use `const dbc = input.client ?? db;` internally.
- `insertOrRestoreRosteredPlayer(input)` → same optional `client`; replace `db.transaction(...)` with `dbc.transaction(...)` (a nested call on a tx client becomes a savepoint — acceptable).

Existing callers pass nothing and are unaffected.

**Verify**: `pnpm typecheck` → exit 0; `pnpm test:db` → all pass unchanged (behavior identical).

### Step 2: Reorder and wrap `applyAwardedClaim`

Restructure `applyAwardedClaim` (process.ts:434-533) into **validate-then-commit**:

1. Keep all reads and validations as they are, but **move the `waiveOrDeleteRosterRow` call out** of the `claim.dropPlayerId` block — in that block only resolve `dropRow` (error if missing) and filter `rosteredOnTeam` in memory, exactly as the capacity checks already expect.
2. After ALL checks pass (roster max, position max), commit everything in one transaction:

```ts
await db.transaction(async (tx) => {
  if (dropRow) {
    await waiveOrDeleteRosterRow({
      rowId: dropRow.rosterRowId,
      waiversEnabled: season.waiversEnabled,
      dropWaiverHours: wire.dropWaiverHours,
      client: tx,
    });
  }
  await insertOrRestoreRosteredPlayer({ ...as today..., client: tx });
});
```

3. Return type and error strings unchanged — the caller's failed/awarded handling keeps working.

Note the pre-existing checks that run before the drop (`seasonRows` rostered check, IR lock, player existence) stay where they are. Do not add new validations.

**Verify**: `pnpm test:db` — the happy-path award tests still pass; the KNOWN BUG characterization test now **fails** (expected — flip it in Step 4).

### Step 3: Make `cutAndAddPlayer` atomic

In `lib/actions/roster.ts`, rewrite `cutAndAddPlayer` so validation happens up front and writes commit together. Structure:

1. Load context once (`getRosterActionContext(slug)`), as `cutPlayerFromRoster` does.
2. **Validate the cut** (reuse the exact logic from `cutPlayerFromRoster` lines 303–334: find the rostered row, churn check). Extract that logic into a local helper `prepareCut(context, playerId)` returning `{ row, skipWaivers } | { error }` and have `cutPlayerFromRoster` call it too, so the two paths cannot drift.
3. **Validate the add** with the cut simulated: reuse the availability checks from `addPlayerToRoster` (player lookup, `getAcquisitionKind`, roster/position caps) but compute caps against `listRosteredPlayers(team.id)` minus the cut player. Extract `prepareAdd(context, playerId, opts?: { excludeRosterRowId?: string })` similarly and have `addPlayerToRoster` call it with no exclusion. Keep the `requiresCut` cut-candidate response shape in `addPlayerToRoster` unchanged.
4. Commit in one transaction:

```ts
await db.transaction(async (tx) => {
  await waiveOrDeleteRosterRow({ rowId: cut.row.id, ..., skipWaivers: cut.skipWaivers, client: tx });
  await insertOrRestoreRosteredPlayer({ ...add..., client: tx });
});
```

5. Log both activity rows (`player_dropped`, `player_added`) after the transaction commits, matching the summaries used today; then `revalidateRosterPaths(league.publicId)` once.
6. Delete the "Player was cut, but the add failed" apology path — it is now unreachable by construction; on any validation failure return before writing anything.

Keep `cutPlayerFromRoster` and `addPlayerToRoster` behavior identical when called individually (they now delegate to the extracted prepare helpers — same checks, same order, same error strings).

**Verify**: `pnpm typecheck` → exit 0; `pnpm lint lib/actions/roster.ts` → 0 errors; `grep -n "Player was cut, but the add failed" lib/actions/roster.ts` → no matches.

### Step 4: Flip the characterization and add rollback tests

In `lib/leagues/waivers/process.dbtest.ts`:
- Flip the `CHARACTERIZATION OF KNOWN BUG` test: same setup (award whose position-max check fails post-drop) now asserts the claim is `failed` AND the drop player's roster row is **still `rostered`** (untouched). Remove the KNOWN BUG marker comment; rename the test to state the invariant ("a failed claim leaves the roster untouched").
- Add: award with `dropPlayerId` where `insertOrRestoreRosteredPlayer` will violate the season-wide unique rostered constraint (pre-roster the claimed player on the other team *between* validation and commit is hard to simulate synchronously — instead assert the simpler invariant: if the transaction throws, the drop is rolled back. Trigger it by pre-inserting a conflicting `rostered` row for the claimed player *before* processing but after constructing the claim, then assert the claim is marked `failed` (the pre-drop `seasonRows` check catches it) and the roster untouched. If you cannot construct a mid-transaction failure deterministically, the flipped position-max test already proves the reorder; note it and move on.)

Add cut-and-add tests (new `lib/actions/roster.dbtest.ts` is likely blocked — `lib/actions/roster.ts` is a `"use server"` module and also imports ESPN scoreboard helpers; test at the boundary you CAN import under the harness. If importing the action module under `--conditions react-server` works and `getRosterActionContext` can be satisfied by seeding `profiles`/`leagueMembers`, write: cut-and-add where the add fails validation → cut player still rostered. If the action module cannot be imported (Supabase session dependency in `requireSessionUser`), STOP for this sub-test only, record "cut-and-add covered by manual test" in the plan status note, and keep the roster-writes coverage from the waiver tests.)

**Verify**: `pnpm test:db` → 0 fail, no `CHARACTERIZATION OF KNOWN BUG` marker remains for the waiver case (`grep -rn "plan 010 flips" lib` → no matches). `pnpm test`, `pnpm typecheck`, `pnpm lint` all green.

## Test plan

- Flipped: failed waiver claim leaves roster untouched (was the pinned bug).
- New: transaction rollback keeps the drop when the award cannot complete.
- New (best-effort, see Step 4): cut-and-add validation failure leaves the cut player rostered.
- Pattern: `lib/leagues/waivers/process.dbtest.ts` from plan 009.
- Verification: `pnpm test:db` → all pass.

## Done criteria

- [ ] `applyAwardedClaim` performs no DB write before all validations pass, and its writes are in one `db.transaction`
- [ ] `cutAndAddPlayer` performs cut+add in one transaction; the apology error string is gone from the codebase
- [ ] The plan-009 waiver KNOWN BUG characterization is flipped to assert the safe invariant
- [ ] `pnpm test`, `pnpm test:db`, `pnpm typecheck`, `pnpm lint` all exit 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 009 is not DONE (no harness / no characterization tests exist).
- The `prepareCut`/`prepareAdd` extraction forces a change to `addPlayerToRoster`'s `requiresCut` response shape (the cut-candidates dialog in `components/team/` depends on it).
- Nested `tx.transaction` (savepoint) inside `insertOrRestoreRosteredPlayer` misbehaves under PGlite or postgres.js — report rather than flattening the helper's transaction semantics for all callers.
- You find additional callers of `waiveOrDeleteRosterRow`/`insertOrRestoreRosteredPlayer` whose semantics would change (search both symbol names repo-wide first; expected callers: `lib/actions/roster.ts`, `lib/actions/waivers.ts`, `lib/leagues/waivers/process.ts`).

## Maintenance notes

- Any future roster mutation that pairs a removal with an addition (e.g. IR moves, trade-adjacent drops) should follow this validate-then-single-transaction shape and pass `client: tx` through the helpers.
- Reviewers: scrutinize that `prepareAdd`'s cap math with `excludeRosterRowId` matches `addPlayerToRoster`'s standalone math — that's the one place logic is shared-but-parameterized.
- Deferred deliberately: waiver cron lease / overlapping-run protection (CORRECTNESS-06 in the audit) and per-claim query batching (PERF-04) — both touch this file; land this correctness fix first.
