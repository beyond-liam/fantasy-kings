# Plan 025: Split league-settings server action module

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- lib/actions/league-settings.ts lib/actions/`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED
- **Depends on**: none (do **after** beta P1 correctness plans)
- **Category**: tech-debt
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

`lib/actions/league-settings.ts` is ~1908 lines (repo median ~122) with high churn and no direct tests. Same class of problem as `roster.ts` (~1019). Splitting improves reviewability but is **not** required for beta kickoff — schedule after 001–010.

## Current state

- God modules: `league-settings.ts`, `roster.ts`, `trades.ts`
- Settings already use zod in places — preserve that
- `"use server"` file boundaries matter: Next requires exported actions to stay server-callable — use re-export facades carefully

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Build | `pnpm build` | exit 0 |
| Tests | `pnpm test` | exit 0 |

## Scope

**In scope**:
- Extract domain modules under `lib/actions/league-settings/` (scoring, playoffs, waivers, danger-zone, …)
- Keep stable import paths for UI: either update imports or re-export from `league-settings.ts` facade
- Do **one** god file this plan (`league-settings` only). Roster/trades are follow-ups.

**Out of scope**:
- Behavior changes / settings semantics
- Full characterization test suite for every action (nice-to-have subset OK)
- Plan 014 zod work — if both land, coordinate to avoid merge pain (prefer 014 first)

## Git workflow

- Branch: `advisor/025-split-league-settings`
- Commit message example: `Split league-settings server actions into domain modules.`
- Do NOT push unless instructed.

## Steps

### Step 1: Map exports

List `export async function` in `league-settings.ts` and group by domain.

### Step 2: Extract one domain first

Move scoring settings actions + schemas; re-export; run typecheck/build.

### Step 3: Extract remaining domains incrementally

Commit per domain if possible.

### Step 4: Ensure UI imports still work

**Verify**: `pnpm build` (Server Action module graph is the real gate)

## Test plan

- Build is the primary gate
- Spot-check commissioner settings pages manually if possible

## Done criteria

- [ ] `league-settings.ts` is a thin facade or deleted with updated imports
- [ ] No behavior change
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build` exit 0
- [ ] `plans/README.md` 025 → DONE

## STOP conditions

- Next.js Server Action boundaries break with nested `"use server"` files — use the pattern Next docs recommend; if stuck after two attempts, STOP
- Extract wants to change settings validation behavior — out of scope

## Maintenance notes

- Next: same treatment for `roster.ts`
- Prefer after 014 to avoid double-touching validation
