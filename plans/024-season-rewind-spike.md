# Plan 024: Spike season rewind (design only until enough real weeks)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- docs/PROJECT_SPEC.md lib/queries/league-hall-of-fame.ts lib/queries/overview-weekly-roast.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M (design/spike; build later)
- **Risk**: MED
- **Depends on**: enough final weeks of real season data; HoF/roast/stats already shipped
- **Category**: direction
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

Season rewind is listed in PROJECT_SPEC as remaining engagement. Friend-group beta wrap-ups are highly shareable, and HoF + roast + Team Stats already produce narrative inputs. Scope creep into “archive browser” is permanently out of scope per product rules — this plan is a **design spike + optional static prototype**, not a full archive product.

## Current state

- HoF: `lib/queries/league-hall-of-fame.ts`
- Roast: `lib/queries/overview-weekly-roast.ts`
- Team Stats builders
- Spec: season rewind unchecked; archive browser out of scope

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Docs | n/a | spike doc exists |

## Scope

**In scope**:
- `docs/` spike: single end-of-season recap page composition (sections, data sources, what is NOT included)
- Optional read-only prototype route behind commissioner flag or `NODE_ENV=development` only
- List open questions (when to unlock, share image Y/N)

**Out of scope**:
- Full multi-season archive browser
- Building share-card image pipeline unless trivial
- Blocking other P1 plans

## Git workflow

- Branch: `advisor/024-season-rewind-spike`
- Commit message example: `Document season rewind composition spike for end-of-beta.`
- Do NOT push unless instructed.

## Steps

### Step 1: Write spike doc

Compose from existing queries; one page outline.

### Step 2: Decide build/no-build

If <4 final weeks of data exist in prod, **do not** ship a user-facing route — docs only.

### Step 3: Spec note

Mark as “designed / deferred to end of season” in PROJECT_SPEC.

**Verify**: no secrets; doc links to real modules

## Test plan

Docs/prototype only.

## Done criteria

- [ ] Spike doc committed
- [ ] No archive-browser scope creep
- [ ] Spec status clarified
- [ ] `plans/README.md` 024 → DONE

## STOP conditions

- Spike turns into a multi-week build — stop and re-scope
- Product owner wants archive browser — reject per PROJECT_SPEC out-of-scope

## Maintenance notes

- Revisit after week 10+ of real finals
