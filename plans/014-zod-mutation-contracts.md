# Plan 014: Add zod contracts to high-risk mutation actions

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- lib/actions/trades.ts lib/actions/waivers.ts lib/actions/roster.ts lib/actions/draft.ts app/api/watchlist/route.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

League settings actions already use zod; trades/waivers/roster/draft mutations take raw arrays/strings with ad-hoc checks. Trade `comment` is unbounded text while messages cap at 10_000. Watchlist API casts JSON without schema. Authz via `loadLeagueActionContext` is generally present — add input contracts on top.

## Current state

- Exemplar: `lib/actions/league-settings.ts` uses `safeParse` on settings payloads
- `proposeTrade` (`trades.ts` ~250+) — raw offer id arrays + optional comment, only trim
- `fileWaiverClaim`, `updateRosterSlots`, `makeDraftPick` — no zod at boundary
- Messages cap: `lib/actions/messages.ts` body max 10_000
- Watchlist: `app/api/watchlist/route.ts` — presence checks only

Use **zod v4** already in `package.json` (`zod`: `^4.4.3`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test` | exit 0 |

## Scope

**In scope**:
- `lib/actions/trades.ts` — propose/counter/comment paths; `comment` max length (suggest 2000 or match messages 10_000 — pick ≤ 2000 unless UI needs more)
- `lib/actions/waivers.ts` — file/cancel claim inputs
- `lib/actions/roster.ts` — slot update / add-cut payloads
- `lib/actions/draft.ts` — make pick / related mutations
- `app/api/watchlist/route.ts` — zod body
- Optional shared `lib/actions/schemas/*.ts` if it reduces duplication

**Out of scope**:
- Re-auditing authz (assume loadLeagueActionContext stays)
- Splitting god files (025)
- Changing UI forms except fixing broken payloads if schemas reveal mismatches

## Git workflow

- Branch: `advisor/014-zod-mutation-contracts`
- Commit message example: `Validate trade, waiver, roster, and draft action inputs with zod.`
- Do NOT push unless instructed.

## Steps

### Step 1: Trade schemas + comment cap

Define schemas for UUID arrays (max reasonable length, e.g. 20), optional comment `z.string().trim().max(2000).optional()`, slug strings.

`safeParse` at the start of `proposeTrade` / counter equivalents; return field errors consistent with other actions.

**Verify**: `pnpm typecheck`; reject oversize comment in a small unit test of the schema

### Step 2: Waivers + roster + draft

Mirror step 1 for the hottest exports (grep `export async function` in each file). Validate enums/UUIDs/array caps before DB work.

**Verify**: typecheck; smoke that existing UI types still assignable (adjust schema to match UI, not the reverse, unless UI was sending garbage)

### Step 3: Watchlist API

```ts
const bodySchema = z.object({
  slug: z.string().trim().min(1).max(64),
  playerId: z.string().uuid(),
});
```

Return 400 on failure.

**Verify**: `pnpm typecheck`

## Test plan

- Schema unit tests for comment max, empty arrays, invalid uuid
- Do not require full action dbtests unless easy

## Done criteria

- [ ] proposeTrade (and counter if present) zod-validated with comment max
- [ ] Waiver/roster/draft mutation entrypoints zod-validated
- [ ] Watchlist POST/PUT body zod-validated
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` exit 0
- [ ] `plans/README.md` 014 → DONE

## STOP conditions

- UI payload shapes cannot be expressed without reading every client — inspect the calling components; if still ambiguous, STOP with the payload example
- Schema would break intentional string team public ids mistaken for UUIDs — use the id type the DB actually uses (uuid vs public id)

## Maintenance notes

- Reviewer: ensure error messages are user-safe
- Keep authz checks; zod is not a substitute for membership
