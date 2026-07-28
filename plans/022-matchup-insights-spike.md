# Plan 022: Spike matchup insights + would-have-won

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- lib/leagues/team-stats-charts.ts components/leagues/ components/team/ docs/PROJECT_SPEC.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/019-dedupe-finals-mapping.md` helpful but not required
- **Category**: direction
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

Spec still lists matchup insights (positional edges, median/luck, bench/optimal) and “would have won” as deferred. Team Stats already computes luck / bench waste / optimal record helpers in `lib/leagues/team-stats-charts.ts`. Lifting shared builders into Game Centre is mostly composition and high beta engagement.

## Current state

- Team Stats charts 1–4 + headline metrics shipped
- Game Centre preview already has rivalry/predictor/injuries
- Spec warns luck definitions must stay consistent across surfaces (`PROJECT_SPEC` ~§6)

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `pnpm test -- lib/leagues/team-stats-charts` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |

## Scope

**In scope**:
- Design spike doc: which insights appear on scheduled vs live vs final matchups; copy that distinguishes Team Stats season luck vs single-matchup luck
- Extract shared pure helpers if not already exported cleanly
- Ship **one** insight panel on final matchups (recommended: “would have won with optimal lineup” using OPF vs opponent) behind clear labeling
- Spec checklist update

**Out of scope**:
- Full insights suite in one PR
- Changing Team Stats chart definitions
- Season rewind (024)

## Git workflow

- Branch: `advisor/022-matchup-insights-spike`
- Commit message example: `Spike matchup would-have-won insight using existing OPF helpers.`
- Do NOT push unless instructed.

## Steps

### Step 1: Design note + vocabulary

Align with PROJECT_SPEC luck warning.

### Step 2: Wire one panel

Reuse `buildOptimalRecordSummary` / bench waste week row fields where possible; avoid reimplementing OPF.

Follow UI standards (shadcn, button icons, polish skill if touching visuals).

### Step 3: Tests

Extend team-stats-charts or matchup helper tests for the shared function used by the panel.

**Verify**: typecheck/lint/tests

## Test plan

- Pure function cases for would-have-won W/L vs actual
- Manual Game Centre final matchup view

## Done criteria

- [ ] Design note + one shipped insight on finals
- [ ] Spec updated for partial progress
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` exit 0
- [ ] `plans/README.md` 022 → DONE

## STOP conditions

- OPF data missing for the week — show empty state, do not invent points
- Confusion with HoF “lucky” plaques — different copy required; STOP if product naming conflicts unresolved

## Maintenance notes

- Next slices: positional edges, median comparison
