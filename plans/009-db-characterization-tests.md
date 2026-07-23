# Plan 009: Stand up an in-memory Postgres test harness and characterize the draft/waiver/trade mutation cores

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e1e7f1e..HEAD -- lib/db.ts lib/leagues/draft/pick.ts lib/leagues/waivers/process.ts lib/leagues/trades/lifecycle.ts lib/leagues/trades/execute.ts package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (characterization must pin current behavior, including two known bugs, without fixing them)
- **Depends on**: plans/007-verification-baseline.md (test glob + green gates)
- **Category**: tests
- **Planned at**: commit `e1e7f1e`, 2026-07-23

## Why this matters

The three highest-risk mutation paths in this fantasy-football app — draft pick commit, waiver processing, and the trade lifecycle — have **zero direct test coverage**. Existing tests cover only pure helpers (adjudication math, calendars, validators). Plans 010 and 011 refactor exactly these paths to fix real atomicity/race bugs; without characterization tests first, those refactors are blind. This plan adds a DB-backed test harness using PGlite (in-memory WASM Postgres — free, no Docker, satisfies the repo's free-tier-only rule) and pins current behavior.

**Critical: characterization means CURRENT behavior.** Two tests in this plan intentionally assert buggy behavior and are marked with `// CHARACTERIZATION OF KNOWN BUG — plan 010/011 flips this assertion`. Do not fix the bugs here.

## Current state

- DB client: `lib/db.ts` creates a `postgres.js` client and exports `export const db = drizzle(client, { schema })`. The connection is lazy — importing `lib/db.ts` without `DATABASE_URL` does not throw; only queries would. Full current file:

```ts
// lib/db.ts (all 37 lines, abridged comments)
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL!;
const globalForDb = globalThis as unknown as { client: ...; connectionString: ... };
const client = /* cached-or-new */ postgres(connectionString, { max: 1, prepare: false, ssl: "require" });
if (process.env.NODE_ENV !== "production") { globalForDb.client = client; ... }
export const db = drizzle(client, { schema });
```

- The modules under test import `db` directly and also start with `import "server-only"`:
  - `lib/leagues/draft/pick.ts` — `commitDraftPick(input)` (line 80): validates player/turn/roster caps via reads (lines 112–209), then one `db.transaction` inserting the `draft_picks` row, upserting the roster row, clearing queues, and advancing `drafts.currentPickIndex` (lines 228–296). Unique indexes on `(draftId, overall)` and `(draftId, playerId)` exist in `db/schema/drafts.ts`.
  - `lib/leagues/waivers/process.ts` — `processSeasonWaivers(input)` (line 68): seeds priorities/FAAB, adjudicates via pure `adjudicateWaiverClaims`, then loops outcomes applying `applyAwardedClaim` (line 434) per claim. **Known bug** (fixed by plan 010): `applyAwardedClaim` performs the drop (`waiveOrDeleteRosterRow`, line 479) BEFORE the roster-full/position-max checks (lines 489–510) and before the add (line 512) — a failure after the drop leaves the roster short with the claim marked `failed`.
  - `lib/leagues/trades/lifecycle.ts` — `commitTradeProposal` (99), `acceptTradeOffer` (194), `rejectTradeOffer` (284), `cancelTradeOffer` (318), `castTradeVeto` (439), `completeExpiredTrade` (42). **Known bug** (fixed by plan 011): `acceptTradeOffer` writes `status: input.nextStatus` (which is `"completed"` for instant-processing leagues) at lines 218–226 BEFORE calling `executeTrade`; all status updates are unconditional `WHERE id = ?`.
  - `lib/leagues/trades/execute.ts` — `executeTrade` (60): reads trade + roster rows, checks availability OUTSIDE the transaction, then one `db.transaction` moving players and setting `status: "completed", completedAt` unconditionally (lines 217–224).
- `server-only` package: under plain node, importing it throws. Under `node --conditions react-server` it resolves to an empty module. `tsx` forwards `--conditions`.
- Notifications/alerts side effects inside these modules: `processSeasonWaivers` calls `createNotifications` (DB inserts — fine under the harness). `lifecycle.ts` calls `notifyUsers` (DB inserts) and `announceTrade*` (in-app rows + Brevo email adapter). Check `lib/email/env.ts` / the alert adapters: emails must silently no-op when `BREVO_*` env vars are absent. If they no-op, tests just run with no Brevo env. If they throw, see STOP conditions.
- Drizzle schema (`db/schema/index.ts`) has **no hard FK into Supabase's `auth` schema** (verified — `profiles.id` merely "matches" auth.users.id by convention), so the schema can be pushed to a vanilla Postgres. Do NOT apply the SQL files in `db/migrations/` to PGlite — `0003_logos_storage.sql` contains Supabase `storage`/`auth.uid()` statements that will fail. Use `drizzle-kit`'s programmatic push instead.
- Existing test conventions: node:test + `assert/strict`, `describe`/`it`, `@/` path alias works under tsx via `tsconfig.json` paths. Exemplar: `lib/leagues/waivers/waivers.test.ts`.
- drizzle-orm `^0.45.2` (has the `drizzle-orm/pglite` driver) and `drizzle-kit ^0.31.10` (has `drizzle-kit/api` with `pushSchema`) are already installed.

## Commands you will need

| Purpose        | Command                                        | Expected on success |
|----------------|------------------------------------------------|---------------------|
| Add dep        | `pnpm add -D @electric-sql/pglite`             | exit 0              |
| Typecheck      | `pnpm typecheck`                               | exit 0              |
| Pure tests     | `pnpm test`                                    | 0 fail              |
| DB tests (new) | `pnpm test:db`                                 | 0 fail              |
| Lint           | `pnpm lint`                                    | 0 errors            |

## Scope

**In scope** (the only files you should modify/create):
- `package.json` (add `@electric-sql/pglite` devDependency + `test:db` script)
- `lib/db.ts` (add a test-only setter — see Step 2; nothing else changes)
- `lib/test/harness.ts` (create)
- `lib/test/seed.ts` (create)
- `lib/leagues/draft/pick.dbtest.ts` (create)
- `lib/leagues/waivers/process.dbtest.ts` (create)
- `lib/leagues/trades/lifecycle.dbtest.ts` (create)
- `.github/workflows/verify.yml` (append the `pnpm test:db` step, if the file exists from plan 007)
- `lib/alerts/deliver.ts` — **only** the minimal hardening in Step 7a (make `after()` safe outside a Next request). No other alert/email changes.

**Out of scope** (do NOT touch):
- Any behavior change in `pick.ts`, `process.ts`, `lifecycle.ts`, `execute.ts`, `roster-writes.ts` — this plan only observes those.
- `db/migrations/` — never applied in tests.
- Server actions in `lib/actions/` — test the domain cores directly.
- Broader email/alert refactors beyond Step 7a.

## Git workflow

- Branch: `advisor/009-db-characterization-tests`
- Commit per step; message style: single imperative sentence with a period.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Install PGlite and prove the import path works

`pnpm add -D @electric-sql/pglite`

Then prove the two risky assumptions in one throwaway script (delete after):

```ts
// scratch-harness-check.ts (temporary, repo root)
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";

const client = new PGlite();
const testDb = drizzle(client, { schema });
const { pushSchema } = await import("drizzle-kit/api");
const { apply } = await pushSchema(schema, testDb as never);
await apply();
console.log("schema pushed OK");
```

Run: `pnpm exec tsx --conditions react-server scratch-harness-check.ts` → prints `schema pushed OK`.

Notes: `pushSchema`'s exact signature is in `node_modules/drizzle-kit/api.d.ts` — consult it and adjust (it may want the drizzle instance typed as `PgDatabase`). If enum/serial defaults fail to push, read the error; PGlite supports standard Postgres DDL, so failures usually mean a signature mismatch, not a capability gap.

**Verify**: the script prints `schema pushed OK`, then delete it (`git status` clean apart from package.json/lockfile).

### Step 2: Add the test-only DB setter

In `lib/db.ts`, change the export to a live binding with a setter:

```ts
export let db = drizzle(client, { schema });

/** Test-only: swap the db instance (PGlite harness). Never call from app code. */
export function __setDbForTest(next: typeof db) {
  db = next;
}
```

ESM live bindings mean every module that did `import { db } from "@/lib/db"` sees the swap. The type of a PGlite drizzle instance differs nominally from postgres-js drizzle; in the harness, cast with `as unknown as typeof db` — the query-builder surface used by the app (`select/insert/update/delete/transaction/query`) is identical.

**Verify**: `pnpm typecheck` → exit 0. `pnpm build` → exit 0 (the setter is dead code in prod; confirm Next doesn't complain). `grep -rn "__setDbForTest" app components lib --include="*.ts" --include="*.tsx" | grep -v test` → only `lib/db.ts`.

### Step 3: Create the harness

`lib/test/harness.ts`:

```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "@/db/schema";
import { db, __setDbForTest } from "@/lib/db";

/** Create a fresh in-memory Postgres, push the Drizzle schema, swap it in. */
export async function createTestDb() {
  const client = new PGlite();
  const testDb = drizzle(client, { schema });
  const { pushSchema } = await import("drizzle-kit/api");
  const { apply } = await pushSchema(schema, testDb as never);
  await apply();
  __setDbForTest(testDb as unknown as typeof db);
  return testDb;
}
```

Each test FILE calls `createTestDb()` once in a top-level `before()`; individual tests create their own leagues/teams so they don't collide (cheaper than re-pushing schema per test). node:test runs each file in its own process, so files don't share the swapped instance.

`lib/test/seed.ts` — fixture builders returning inserted ids. Build exactly what the suites below need; consult `db/schema/*.ts` for required columns and copy defaults from `lib/leagues/defaults.ts` where a settings JSON is needed:

- `seedLeagueSeason(overrides?)` → inserts `leagues` (slug/publicId/inviteCode — short unique strings), `league_seasons` (settings JSON: use `resolveDraftSettings`/roster-slot defaults from `lib/leagues/defaults.ts`; set `teamCount: 2`, `benchSlots`, `waiversEnabled: true`, `waiverType: "faab"`, `faabBudget: 100`), returns `{ league, season }`.
- `seedTeams(seasonId, n)` → n `teams` rows with `draftSlot` 1..n, `waiverPriority` 1..n, distinct fake `userId`s inserted into `profiles` first if the FK requires it (check `db/schema/teams.ts`).
- `seedPlayers(n)` → n `players` rows (`primaryPositionId: "RB"` etc. — check `positions` table FK; insert the position rows first: copy ids from `db/seed/positions.ts`).
- `seedDraft(seasonId)` → one `drafts` row with `status: "live"`, `currentPickIndex: 0`.
- `seedRosterPlayer(teamId, seasonId, playerId, overrides?)` → one rostered row.

**Verify**: a trivial smoke test in the harness file's suite: insert + select a league via the swapped `db`. Run `pnpm exec tsx --conditions react-server --test lib/test/harness.dbtest.ts` equivalent, or fold the smoke into Step 4's first suite.

### Step 4: Add the `test:db` script

In `package.json` scripts:

```json
"test:db": "tsx --conditions react-server --test 'lib/**/*.dbtest.ts'"
```

The `react-server` condition makes `import "server-only"` resolve to an empty module so the domain cores can be imported under node. Keep `pnpm test` (pure suites) unchanged — pure tests must not pay the condition's resolution changes.

**Verify**: `pnpm test` still passes (unchanged); `pnpm test:db` runs (0 files initially is fine, or the Step 3 smoke passes).

### Step 5: Characterize `commitDraftPick`

`lib/leagues/draft/pick.dbtest.ts` — seed a season, 2 teams with draft slots, a live draft at index 0, and ~4 players. Cases:

1. **Happy path**: `commitDraftPick` for the on-clock team → `ok: true`; asserts a `draft_picks` row with `overall` 1, a `rosterPlayers` row (`status: "rostered"`) for the team, and `drafts.currentPickIndex` advanced to 1.
2. **Not your turn**: `source: "manual"`, `actingTeamId` = the other team → `ok: false`, error "It is not your turn to pick.", no rows written.
3. **Player already drafted**: same player twice → second returns `ok: false` ("Player has already been drafted.").
4. **Roster full**: seed a season whose `rosterSlots`/`benchSlots` yield max size 1, pre-roster one player on the on-clock team → `ok: false` ("This team's roster is full.").
5. **Draft completes**: with a 2-team × 1-round schedule, the last pick sets `drafts.status = "complete"` and `league_seasons.status = "active"`.

Build the `CommitDraftPickInput` directly (it takes plain data: seasonId, draftId, currentPickIndex, settings JSON, seasonTeams array) — no server action involved.

**Verify**: `pnpm test:db` → all cases pass.

### Step 6: Characterize `processSeasonWaivers`

`lib/leagues/waivers/process.dbtest.ts` — seed FAAB season (budget 100), 2 teams, players; insert `waiver_claims` rows with `status: "pending"` and `createdAt` in the past so they are eligible (see `isClaimEligibleForProcess` in `lib/leagues/waivers/calendar.ts`; pass a `now` that is a process day — the function takes `now?: Date`, use a Wednesday after 10:00 UTC, e.g. `new Date(Date.UTC(2026, 6, 15, 11, 0, 0))`, matching the conventions in `waivers.test.ts`). Cases:

1. **Highest bid wins**: two claims on one player, bids 30 vs 20 → higher bid's claim `awarded`, player rostered on winner, winner's `teams.faabRemaining` = 70; loser claim `failed`.
2. **Drop applied**: winning claim with `dropPlayerId` → dropped player's roster row is `waived` (or deleted when waivers off), added player rostered.
3. **`lastWaiverProcessedAt` stamped** on the season after the run.
4. **KNOWN BUG characterization**: winning claim whose add will fail post-drop — construct: claim has a `dropPlayerId`, but the claimed player is made unavailable *after adjudication would pass*… the simplest reliable trigger is a **position-max failure**: set season `rosterSlots` so the claimed player's position is already at max even after the drop (drop a player of a different position). Assert CURRENT behavior: claim `failed` AND the dropped player's row is `waived`/gone (roster is short). Mark:
   `// CHARACTERIZATION OF KNOWN BUG — plan 010 flips this: a failed claim must leave the roster untouched.`

**Verify**: `pnpm test:db` → all cases pass.

### Step 7a: Harden `queueEmailsAfter` for non-request contexts (required for Step 7)

> **Added 2026-07-23 after execute STOP**: `announceTradeProposed` / `announceTradeAcceptedReview` /
> `announceTradeVetoed` call `deliverAlert` → `queueEmailsAfter` → Next.js `after()` from
> `next/server`. Outside a live request (node:test), `after()` throws
> `` `after` was called outside a request scope `` **before** Brevo config is read — so
> clearing `BREVO_*` does not help. Cron paths already pass `email.sync: true` to avoid this.

In `lib/alerts/deliver.ts`, change `queueEmailsAfter` only:

```ts
function queueEmailsAfter(userIds: string[], email: EmailAlert) {
  try {
    after(() => {
      void sendEmailsNow(userIds, email).catch((error) => {
        console.error("[alerts] email adapter failed", error);
      });
    });
  } catch {
    // Outside a Next.js request (scripts, node:test) — skip deferred email.
    // Cron/server paths that need mail should pass email.sync: true.
  }
}
```

This is production-hardening (fail soft outside request scope), not a test-only flag. Do not change announce* call sites or Brevo sending.

**Verify**: `pnpm typecheck` → exit 0. A one-line smoke that imports and calls `queueEmailsAfter` is unnecessary — Step 7 is the proof.

### Step 7: Characterize the trade lifecycle

`lib/leagues/trades/lifecycle.dbtest.ts` — seed season, 2 teams, players rostered on each side. Run without any `BREVO_*` env. Cases:

1. **Propose**: `commitTradeProposal` → `trades` row `status: "pending"`, `trade_players` offer rows, `league_activity` `trade_proposed` row.
2. **Accept → review**: `acceptTradeOffer` with `nextStatus: "review"`, `reviewEndsAt` future → status `review`; rosters unchanged.
3. **Execute swaps rosters**: `executeTrade` on the review trade → both offered players' `rosterPlayers.teamId` swapped, `slotPositionId` null, trade `completed` with `completedAt` set.
4. **Execute is idempotent once completed**: second `executeTrade` call → `{ success: true }`, no duplicate activity.
5. **Veto threshold**: insert veto votes via `castTradeVeto` until threshold (see `vetoThreshold`/`countEligibleVetoVoters` in `lib/leagues/trades/vetoes.ts` — with small team counts check what threshold 2–4 teams yields and seed accordingly) → trade `vetoed`.
6. **KNOWN BUG characterization — veto/execute race shape**: after a trade is `vetoed`, call `executeTrade` directly. Assert CURRENT behavior — line 88-95 of `execute.ts` rejects `vetoed` ("Trade is no longer open."), BUT the reverse interleaving is the bug: complete the trade via `executeTrade`, then call the raw status update path a vetoer would hit — simplest honest characterization: assert that `executeTrade` on an already-`completed` trade with `completedAt` returns success (idempotent), and that `acceptTradeOffer` with `nextStatus: "completed"` sets status BEFORE execute by checking status is `completed` even when `executeTrade` would fail (e.g. make an offered player unavailable first). Mark:
   `// CHARACTERIZATION OF KNOWN BUG — plan 011 flips this: status must not be completed when execute fails.`
7. **Conflicting open trades invalidated**: two pending trades sharing a player; complete one → the other becomes `invalidated` with a `trade_cancelled` activity row (this is `invalidateConflictingTrades`, execute.ts:14-57 — current GOOD behavior worth pinning).

**Verify**: `pnpm test:db` → all cases pass. `pnpm test` and `pnpm lint` still green.

### Step 8: Wire into CI

If `.github/workflows/verify.yml` exists (plan 007), append `- run: pnpm test:db` after the `pnpm test` step.

**Verify**: file contains both test steps; `git status` shows only in-scope files.

## Test plan

This plan IS the test plan. Final state: 3 new `.dbtest.ts` suites (≈16 cases) passing under `pnpm test:db`, two of them explicitly marked as characterizations of known bugs.

## Done criteria

- [ ] `pnpm test:db` exits 0 with ≥14 passing tests across the three suites
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` all still pass
- [ ] `pnpm build` exits 0 (the `lib/db.ts` setter didn't break the app build)
- [ ] Both `CHARACTERIZATION OF KNOWN BUG` markers are present (`grep -rn "CHARACTERIZATION OF KNOWN BUG" lib | wc -l` ≥ 2)
- [ ] No behavior change in any non-test, non-`lib/db.ts` file (`git diff --stat` review)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `import "server-only"` still throws under `tsx --conditions react-server` (Step 1 proves this early — if it fails, report; do not start hand-editing node_modules or the domain modules).
- `pushSchema` from `drizzle-kit/api` doesn't exist or cannot target the PGlite drizzle instance after consulting `api.d.ts` — report the actual exports; do not fall back to applying `db/migrations/*.sql`.
- Importing `lib/leagues/trades/lifecycle.ts` under the harness still throws from `after()` **after** Step 7a is applied — report the stack; do not broaden alert refactors. (Before Step 7a existed, this was a hard STOP; Step 7a is the approved minimal fix.)
- Email adapters make a real network call when `BREVO_*` is absent — inspect `lib/email/`; they should no-op via `getBrevoConfig()` returning null. If not, report.
- Any characterization test reveals behavior that contradicts this plan's description of the code (e.g. the drop actually IS rolled back) — the audit may be wrong; report what you observed.
- PGlite lacks a Postgres feature the schema push needs (unlikely; it supports standard DDL, enums, uuid).

## Maintenance notes

- Plans 010 and 011 MUST flip the two known-bug characterization assertions as part of their done criteria — that is the contract.
- The `__setDbForTest` seam is deliberately crude. If test files ever run in the same process (e.g. a future switch away from node:test's process-per-file), the global swap will leak between files — revisit then.
- New DB-backed suites: name them `*.dbtest.ts` so `pnpm test` (pure, fast) stays separate from `pnpm test:db`.
- Seed helpers in `lib/test/seed.ts` will drift as schema evolves; keep them minimal and typed with Drizzle `$inferInsert` types (matches the repo's "typed mock data" rule in `docs/PROJECT_SPEC.md` §2.7).
