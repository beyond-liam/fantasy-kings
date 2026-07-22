# Plan 002: Server-filter rankings and league players queries

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5b6e84a0e4895a6a3978ffca7b458953f803c968..HEAD -- lib/queries/players.ts app/\\(main\\)/rankings/page.tsx app/league/\\[slug\\]/players/page.tsx components/rankings/use-rankings-params.ts components/rankings/players-data-table.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (benefits from `plans/001-player-scores-week-index.md` if already applied)
- **Category**: perf
- **Planned at**: commit `5b6e84a`, 2026-07-14

## Why this matters

Rankings and league Players intentionally load the **full** season/week/kind scoreboard, then `PlayersDataTable` filters to one position (default QB) on the client. That ships hundreds–thousands of scored rows with JSONB `stats` over the wire for every soft-nav. The query layer already supports `position` / `team` / `rookiesOnly` filters — pages simply never pass them, and URL updates for those params skip server refetch.

## Current state

Filter support exists but unused by pages:

```56:71:lib/queries/players.ts
export async function getRankedPlayers(
  filters: RankingsFilters,
): Promise<RankedPlayerRow[]> {
  const playerConditions = [];

  if (filters.position) {
    playerConditions.push(eq(players.primaryPositionId, filters.position));
  }
  // ... team, rookiesOnly ...
```

Rankings page ignores parsed position/team/rookies:

```53:59:app/(main)/rankings/page.tsx
  const [playersResult, teams] = await Promise.all([
    getRankedPlayers({
      season,
      week,
      kind,
      scoringPreset: scoring,
    }).then(
```

Client-only params (problem):

```6:12:components/rankings/use-rankings-params.ts
export const SERVER_RANKINGS_PARAMS = new Set([
  "season",
  "week",
  "kind",
  "scoring",
]);
```

Client re-filter comment (`components/rankings/players-data-table.tsx:164-189`) documents that server returns the full dataset.

**Product constraints** (`docs/PROJECT_SPEC.md`): Server Components + server actions; TanStack Query deferred. Match existing page patterns.

**Draft exception**: `app/league/[slug]/draft/page.tsx` must keep loading the **full** pool (all positions) until a later plan adds tab-scoped draft pool fetching. Do **not** pass `position` there in this plan.

**League FA filter**: `fa` / free-agents-only depends on ownership maps — keep as **client-only** filter after server returns the position-scoped set.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `pnpm test` | all pass |
| Typecheck | `pnpm exec tsc --noEmit` | only pre-existing errors outside your changes (see STOP) |
| Lint | `pnpm lint` | exit 0 on touched files |

## Scope

**In scope**:
- `components/rankings/use-rankings-params.ts`
- `app/(main)/rankings/page.tsx`
- `app/league/[slug]/players/page.tsx`
- `components/rankings/players-data-table.tsx` (adjust client filter comments / redundant position filter)
- Optional tiny helper test: `lib/rankings/server-params.test.ts` **only if** you extract a shared constant test; otherwise skip
- `plans/README.md` (status)

**Out of scope**:
- Draft pool (`app/league/[slug]/draft/page.tsx`) — keep full pool
- Trimming `stats` JSON keys (Plan 003)
- Team page triple-fetch (Plan 004)
- Pagination / keyset limits (deferred — position filter is the win)
- Changing default position (`DEFAULT_POSITION_FILTER` stays `"QB"`)

## Git workflow

- Branch: `advisor/002-server-filter-rankings`
- Commit message: `Server-filter rankings and players by position`
- Do NOT push/PR unless asked.

## Steps

### Step 1: Promote position/team/rookies to server URL params

In `components/rankings/use-rankings-params.ts`, add `"position"`, `"team"`, and `"rookies"` to `SERVER_RANKINGS_PARAMS`.

When those update, `router.replace` already runs (lines 46–48) — no other change needed there.

**Verify**: `rg "SERVER_RANKINGS_PARAMS" -A8 components/rankings/use-rankings-params.ts` shows the three new keys.

### Step 2: Pass filters into `getRankedPlayers` on Rankings

In `app/(main)/rankings/page.tsx`, the page already parses `position`, `team`, `rookiesOnly`. Pass them:

```ts
getRankedPlayers({
  season,
  week,
  kind,
  scoringPreset: scoring,
  position,
  team: team !== "ALL" ? team : undefined,
  rookiesOnly: rookiesOnly || undefined,
})
```

**Verify**: `rg "position," app/\(main\)/rankings/page.tsx` shows it inside the `getRankedPlayers` call.

### Step 3: Pass filters on league Players page

In `app/league/[slug]/players/page.tsx`, find the `getRankedPlayers` / scored-players call (same season/week/kind pattern ~line 141). Pass `position`, `team`, `rookiesOnly` the same way. Leave `fa` as client-only.

**Verify**: league players call includes `position`.

### Step 4: Simplify client filter

In `components/rankings/players-data-table.tsx`:

- Update the comment at ~164: position/team/rookies are now server params; client still filters FA (league) and can keep a **defensive** position match if desired (harmless if server already filtered).
- Prefer removing redundant `primaryPositionId !== clientView.position` only if you confirm URL and server stay in sync after Step 1; keeping the defensive check is acceptable.

**Verify**: `pnpm lint` exits 0.

### Step 5: Manual smoke (required note in report)

If `pnpm dev` is available: open `/rankings`, switch position QB→RB, confirm Network/RSC refetch happens and table row count drops. If you cannot run the app, state that in the plan status note and rely on code verification.

### Step 6: Mark DONE in `plans/README.md`

## Test plan

- Prefer no new DB-backed test (no test DB harness).
- If adding a unit test, only assert `SERVER_RANKINGS_PARAMS.has("position")` etc. in a tiny `lib/rankings/server-params.test.ts` modeled after `lib/leagues/season-calendar.test.ts` (`node:test` + `tsx --test`). Then add the file path to the `test` script in `package.json`.

## Done criteria

- [ ] Rankings and league Players pass `position` (and team/rookies when set) into `getRankedPlayers`
- [ ] `SERVER_RANKINGS_PARAMS` includes `position`, `team`, `rookies`
- [ ] Draft page still calls `getRankedPlayers` **without** `position`
- [ ] FA filter still works client-side on league players
- [ ] No out-of-scope files changed
- [ ] README status DONE

## STOP conditions

- `attachPositionRanks` behavior confusion: when filtering to one position, ranks are within that set — this is intended and matches previous client-filtered view for that position.
- Pre-existing `tsc` error in `lib/queries/players.ts` stats typing — do not rewrite unrelated scoring types; only stop if **your** changes introduce new errors.
- Product asks for multi-position “ALL” view — STOP and report; out of scope.

## Maintenance notes

- Reviewer: confirm changing position triggers RSC refetch (not only `history.replaceState`).
- Draft still heavy — Plans 003/006 address payload and refresh.
- Follow-up: server-side FA filter using ownership join (not this plan).
