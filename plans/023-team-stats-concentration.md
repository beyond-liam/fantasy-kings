# Plan 023: Ship Team Stats scoring concentration chart

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- components/team/ lib/leagues/team-stats-charts.ts docs/PROJECT_SPEC.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `006` (lineup snapshots — now DONE; re-attempt)
- **Category**: direction
- **Planned at**: commit `73a83c2`, 2026-07-27
- **Execution**: DONE 2026-07-28 (`advisor/023-team-stats-concentration`)

## Why this matters

Charts 1–4 + KPI cards are live. Spec still wants scoring concentration (top scorers’ share of PF). High roster-construction signal for mid-season trades/FAAB. Optional margins chart can stay deferred if KPI strip already covers average margins.

## Current state

- Charts in `components/team/charts/*`
- Builders in `lib/leagues/team-stats-charts.ts`
- Dashboard wires charts in `components/team/team-stats-dashboard.tsx`
- Headline metric pattern: `components/team/charts/chart-headline-metric.tsx`
- UI: shadcn Card, Recharts via existing chart components, Hugeicons on buttons

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `pnpm test -- lib/leagues/team-stats-charts` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |

## Scope

**In scope**:
- Pure builder for concentration series + headline (e.g. top 3 share %)
- New chart component matching existing chart card style
- Wire into Team Stats dashboard
- Unit tests for builder
- PROJECT_SPEC: mark chart 5 done; leave chart 6 optional/deferred

**Out of scope**:
- Chart 6 margins if KPI cards suffice — skip unless trivial
- Mock `?mock=1` data unless needed for empty states

## Git workflow

- Branch: `advisor/023-team-stats-concentration`
- Commit message example: `Add Team Stats scoring concentration chart.`
- Do NOT push unless instructed.

## Steps

### Step 1: Builder + tests

Compute top-N starter PF share vs rest for the season (define N=3 in code constant). Handle empty weeks.

### Step 2: Chart UI

Match `points-by-position-chart.tsx` patterns: Card, ChartHeadlineMetric, ChartContainer, legend order if multi-series.

### Step 3: Dashboard + spec

**Verify**: tests, typecheck, lint; update PROJECT_SPEC §6/§12/changelog

## Test plan

- Builder: known point totals → expected share
- Empty season → empty array / null headline

## Done criteria

- [ ] Concentration chart visible on Team Stats
- [ ] Tests + spec updated
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` exit 0
- [ ] `plans/README.md` 023 → DONE

## STOP conditions

- Starter attribution data insufficient — STOP with data gap rather than using whole roster incorrectly

## Maintenance notes

- Follow chart headline conventions already shipped
- Use make-interfaces-feel-better / shadcn skills for polish
