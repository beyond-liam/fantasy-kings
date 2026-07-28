# Plan 021: Spike advanced player filtering (design + thin slice)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- app/league/[leagueId]/players/ components/leagues/players/ components/rankings/ lib/queries/players.ts docs/PROJECT_SPEC.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

PROJECT_SPEC near-term backlog has **one** product item left: advanced player filtering beyond position / team / rookies / FA. This improves waiver/FA discovery for first real users. This plan is a **design/spike + one thin vertical slice**, not a full filter platform.

## Current state

- Filters today: position / team / rookies / FA (`players/page.tsx`, `players-data-table.tsx`)
- Query: `getRankedPlayers` in `lib/queries/players.ts`
- Spec: `docs/PROJECT_SPEC.md` §1b / §12 advanced filtering unchecked

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |

## Scope

**In scope**:
- Short design note in the PR / `docs/` (1 page): filter model candidates (injury status, owned vs FA, projection range), URL state strategy, query impact
- Implement **one** high-value filter end-to-end (recommended: availability — FA / rostered / waivers — or injury status) wired through URL + `getRankedPlayers`
- Update PROJECT_SPEC checklist for what shipped vs still deferred

**Out of scope**:
- Building every filter at once
- Plan 012 pagination of the full players table (may note dependency)
- IDP

## Git workflow

- Branch: `advisor/021-advanced-player-filtering-spike`
- Commit message example: `Spike advanced player filtering with one end-to-end filter.`
- Do NOT push unless instructed.

## Steps

### Step 1: Design note

List 3–5 filters ranked by user value vs query cost. Pick one for implementation.

### Step 2: Implement thin slice

Extend filters type in `getRankedPlayers`, page searchParams, and table UI (shadcn + Hugeicons on any new buttons per UI standards).

### Step 3: Spec update

Mark partial progress in PROJECT_SPEC.

**Verify**: typecheck/lint; manual filter toggle on players page

## Test plan

- Unit test filter predicate if pure
- Manual: URL round-trip for the new filter

## Done criteria

- [ ] Design note exists
- [ ] At least one new filter works end-to-end
- [ ] Spec updated
- [ ] `pnpm lint`, `pnpm typecheck` exit 0
- [ ] `plans/README.md` 021 → DONE

## STOP conditions

- Filter requires schema/migration for data you don't have (e.g. snap counts) — pick another filter
- Table URL state is already too complex — spike docs only and STOP before large rewrite

## Maintenance notes

- Follow-up filters should reuse the same URL/query pattern
