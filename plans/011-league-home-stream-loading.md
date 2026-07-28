# Plan 011: Stream league home and add route loading UI

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- app/league/[leagueId]/page.tsx app/league/[leagueId]/team/page.tsx components/layout/ app/**/loading.tsx`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

League home (`app/league/[leagueId]/page.tsx`) awaits standings, SOS, Monte Carlo playoff odds (2500 sims), stats, HOF, roast, and highlights **before returning any JSX**. Existing `Suspense` wrappers use already-resolved data (`fallback={null}`), so they do not stream. There are **zero** `loading.tsx` files in the app. Navigations on Vercel Hobby feel stuck on blank shells. My Team already gates work by active tab — mirror that pattern.

Also add `AbortSignal.timeout` on request-path Sleeper/ESPN fetches so a hung origin cannot stall the page forever.

## Current state

- `app/league/[leagueId]/page.tsx:98` awaits `getLeagueHomeData` then continues through ~line 419 before `return`
- Playoff odds always built via `buildPlayoffStandingsRows` → `simulatePlayoffOdds` (2500 sims)
- `getFinalMatchupsForSeason` is called again inside HOF/roast loaders (no `React.cache`)
- Glob `**/loading.tsx` = 0 files
- `lib/sleeper/api.ts:36-40` — `getNflState` fetch with revalidate, no timeout
- UI standards: use existing Skeleton/`components/ui/*`; buttons with icons if adding CTAs; see `.cursor/rules/ui-standards.mdc`

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Build | `pnpm build` | exit 0 |

## Suggested executor toolkit

- Follow `.agents/skills/vercel-react-best-practices/SKILL.md` for Suspense / parallel fetch patterns
- Follow `.agents/skills/shadcn/SKILL.md` for Skeleton usage

## Scope

**In scope**:
- `components/layout/page-skeleton.tsx` (create) — generic route skeleton
- `app/league/[leagueId]/loading.tsx` and at least `app/(main)/dashboard/loading.tsx`, `app/(main)/leagues/loading.tsx`, `app/(main)/scores/loading.tsx`, `app/(main)/rankings/loading.tsx` (or one shared parent loading if structure allows — prefer league + main heavy routes)
- `app/league/[leagueId]/page.tsx` — tab-gate expensive work; real Suspense for async child server components; parallelize independent awaits; `React.cache` on `getFinalMatchupsForSeason` if cheap
- Defer Monte Carlo odds to Playoffs tab only (or cache with short TTL — prefer tab-gate first)
- `lib/sleeper/api.ts` and `lib/espn/scoreboard.ts` — add `AbortSignal.timeout` (e.g. 8–15s) on request-path fetches; keep existing soft-fail `.catch` behavior at callers

**Out of scope**:
- Rewriting My Team page architecture beyond optional loading.tsx
- Plan 012 ranked-players full-league reload fix
- Installing TanStack Query (explicitly deferred in AGENTS.md)

## Git workflow

- Branch: `advisor/011-league-home-stream-loading`
- Commit message example: `Stream league home by tab and add route loading skeletons.`
- Do NOT push unless instructed.

## Steps

### Step 1: Add PageSkeleton + loading.tsx files

Create a simple skeleton matching app padding (`p-6`, header circle + lines, 2–3 content blocks) using `@/components/ui/skeleton`.

Wire `loading.tsx` under `app/league/[leagueId]/` and main heavy routes listed in scope.

**Verify**: files exist; `pnpm typecheck`

### Step 2: Tab-gate league home expensive work

Read how My Team gates by search/tab (`app/league/[leagueId]/team/page.tsx` ~154–160). Apply the same idea:

- Always load: auth, `getLeagueHomeData`, chrome (header, invite, draft alert), active tab essentials
- Overview tab: overview-only queries (highlights/roast as needed)
- Standings: standings + SOS if needed for that table
- Playoffs: bracket + **playoff odds / Monte Carlo**
- Stats / HoF: their loaders only when that tab is active

Pass tab from `searchParams` the same way existing `LeagueHomeTabs` expects (inspect current URL param name before inventing a new one).

**Verify**: `pnpm typecheck`; mentally confirm inactive tabs do not await Monte Carlo

### Step 3: Parallelize remaining independent awaits

After auth + home data, use `Promise.all` for independent fetches within a tab. Deduplicate finals via `React.cache()` wrapping `getFinalMatchupsForSeason` in `finalize.ts` (or a thin cached export in queries).

**Verify**: no sequential await chains that are independent in the hot path (spot-check the page)

### Step 4: External fetch timeouts

```ts
await fetch(url, {
  ...,
  signal: AbortSignal.timeout(10_000),
});
```

Apply to `getNflState` and ESPN scoreboard fetch. Callers that `.catch(() => null)` should still soft-fail.

**Verify**: `pnpm typecheck`; unit tests unaffected

## Test plan

- No mandatory new unit tests; optional: cache/timeout helpers if extracted
- Manual: navigate to league home Overview vs Playoffs and confirm Playoffs is where odds cost lands (profiler optional)

## Done criteria

- [ ] At least league + main heavy routes have `loading.tsx`
- [ ] League home does not compute Monte Carlo odds when Playoffs tab is inactive
- [ ] Sleeper/ESPN request-path fetches use AbortSignal timeouts
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build` exit 0
- [ ] `plans/README.md` 011 → DONE

## STOP conditions

- Tab param wiring would break deep links — preserve existing query keys
- Splitting into async RSC children requires moving too much shared data — prefer tab-gate first, report if Suspense split is blocked
- `AbortSignal.timeout` unsupported in the project's Node target — use AbortController + setTimeout fallback

## Maintenance notes

- Reviewer: ensure default tab still feels complete; no empty Playoffs when selected
- Follow-up: plan 012 reduces cost of remaining ranked-player work on home/team
