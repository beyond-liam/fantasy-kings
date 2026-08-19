# Plan 028: Decouple roster enrichment from the initial roster shell (partial availability seam)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the “STOP conditions” section occurs, stop and report — do
> not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f78943f..HEAD -- components/team/panels/my-team-roster.tsx components/team/panels/my-team-stats.tsx components/team/roster-sections.tsx components/team/stats-sections.tsx 2>/dev/null || true`
> If any in-scope file changed since this plan was written, compare the “Current state” excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none (but benefits from Plan 030’s week resolver refactor)
- **Category**: perf
- **Planned at**: commit `f78943f`, 2026-08-19

## Why this matters

The roster pages feel slow because the initial render blocks on multiple expensive enrichment queries (ownership, projections, ranked stats, roster table stats, and SoS difficulty), all performed server-side in the same RSC render.

Other fantasy apps keep the roster shell instant and hydrate enrichment progressively. This plan introduces a deep module + seam so enrichment can be fetched and applied after the shell is already visible — without “timeout hacks”.

## Current state

### `MyTeamRosterPanel` blocks on all enrichment

`components/team/panels/my-team-roster.tsx:139-171`
```ts
  const ratePlayerIds = rosterPlayers.map((player) => player.id);
  const [rosterRates, projectedById, weekStats, tableStats, sos] =
    await Promise.all([
      getPlayerRosterRatesMap(ratePlayerIds),
      getWeekProjectedFantasyPoints({ ... }),
      getRankedPlayers({ kind: "stats", preserveStats: true }).catch(() => []),
      getRosterTableStatMap({ ... }).catch(() => new Map()),
      getPositionalSosTable({ ... }),
    ]);
```

### `MyTeamStatsPanel` also blocks on expensive enrichment

`components/team/panels/my-team-stats.tsx:52-74`
```ts
  const [seasonRows, charts, rosterEvaluationByMode, sos] = await Promise.all([
    seasonRowsPromise,
    ...,
    seasonRowsPromise.then((rows) =>
      getPositionalSosTable({ season: nflSeason, positionIds: rows.map((p) => p.primaryPositionId), rules: scoringRules })
    ),
  ]);
```

## Target architecture (module + seam)

Introduce a deep **module** for roster enrichment orchestration that returns “partial availability”:
- Core roster shell: what’s required to render player names/positions/slots and week labels immediately.
- Enrichment payload: ownership/projections/ranks/table stats/SoS, fetched via a separate seam after the shell is visible.

Where to put the seam:
- External seam at an HTTP boundary: a small `adapter` layer (route handler) calls the enrichment module and returns JSON.
- Internal seam at a single orchestration module so callers (roster + stats, and later other pages) share one interface.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Unit tests | `pnpm test` | exit 0 |
| DB tests | `pnpm test:db` | exit 0 |
| Build | `pnpm build` | exit 0 |

## Scope

**In scope**:
- Create one new deep enrichment orchestration module under `lib/` that reuses existing query functions:
  - `getPlayerRosterRatesMap`
  - `getWeekProjectedFantasyPoints`
  - `getRankedPlayers`
  - `getRosterTableStatMap`
  - `getPositionalSosTable`
- Add an HTTP seam (route handler) that returns enrichment results in a JSON shape designed for client hydration.
- Refactor `MyTeamRosterPanel` and `MyTeamStatsPanel` to render the shell first and hydrate enrichment after.

**Out of scope**:
- Changing scoring math, ranking sort direction, or SOS blending rules.
- Adding new UI features unrelated to enrichment hydration.

## Git workflow

- Branch: `advisor/028-roster-enrichment-partial-interface`
- Commit message example: `Decouple roster shell from enrichment hydration`
- Do NOT push unless instructed.

## Steps

### Step 1: Extract enrichment orchestration into a reusable deep module

Create `lib/roster-enrichment/load-roster-enrichment.ts` (or another `lib/`-appropriate path) exporting a single deep **module** function with an interface like:

```ts
type LoadRosterEnrichmentInput = {
  teamId: string
  leagueSeasonId: string
  seasonYear: number
  schedule?: ScheduleSettings | null
  scoringRules: ScoringRuleDefinition[]
  fantasyWeek: number
  currentWeek: number
}

export async function loadRosterEnrichment(input: LoadRosterEnrichmentInput): Promise<{
  enrichmentByPlayerId: {
    [playerId: string]: {
      ownedPct: number | null
      startPct: number | null
      projectedPts: number | null
      actualPts: number | null
      stats: unknown // keep whatever the existing UI consumes; prefer typed shape
      tableStats: unknown
    }
  }
  sos: unknown // whatever `withPlayerOpponent` expects
}>
```

Implementation must:
1. Reuse the existing `loadMyTeamNflContext` for ESPN/Sleeper/NFL opponent mapping *inside the module*.
2. Use the existing enrichment query functions (do not rewrite scoring/SoS math).
3. Ensure it can return “empty” enrichment for any sub-query that fails, but do **not** hide failures via blanket `catch {}` without at least logging (see Plan 029 for SoS error semantics).

**Verify**:
- `pnpm typecheck`

### Step 2: Add an HTTP adapter route for the enrichment payload

Add an authenticated route handler (Next.js App Router `app/api/.../route.ts`) that:
1. Validates the caller is allowed to access `leagueSeasonId` / `teamId` (follow existing auth helpers).
2. Accepts query/body inputs to compute the same `LoadRosterEnrichmentInput`.
3. Calls `loadRosterEnrichment`.
4. Returns JSON with an explicit success/error contract.

**Verify**:
- `pnpm typecheck`
- `pnpm lint`

### Step 3: Refactor the roster shell to render immediately

Refactor `components/team/panels/my-team-roster.tsx` so that:
1. It still resolves the week/options/profile/team schedule and builds the core `players` list needed by `TeamRosterSections`.
2. It sets enrichment-dependent fields to `null`/placeholders initially (so roster layout is stable).
3. It adds a client hydration component (new or existing) that fetches the enrichment payload from the new route and applies it to the roster UI.

You should aim for:
- no layout shift when enrichment arrives
- no blank roster while enrichment is loading

**Verify**:
- `pnpm typecheck`

### Step 4: Apply the same seam to the roster-stats panel

Refactor `components/team/panels/my-team-stats.tsx` similarly:
- shell renders with `seasonRows` (or whatever fast subset is required)
- SOS difficulty / charts / evaluation hydrate progressively (if charts/evaluation are expensive, include them in the same payload)

**Verify**:
- `pnpm test`

## Test plan

- Add no new math tests; rely on existing unit + DB tests for correctness of underlying query functions.
- Add one focused UI/server contract test:
  - A route handler returns a stable JSON shape (schema) for an empty roster/enrichment case.

**Verification**:
- `pnpm test`
- `pnpm test:db`

## Done criteria

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test` exits 0
- [ ] `pnpm test:db` exits 0
- [ ] Roster page renders the roster shell without waiting for SoS / ownership / ranked enrichment (manual check in dev logs)
- [ ] No “timeout hacks” (Promise.race with empty Maps) are required for the feature to load; enrichment may still hydrate later.
- [ ] `plans/README.md` status row updated

## STOP conditions

- If `TeamRosterSections` cannot be updated to support enrichment hydration without major prop contract churn, stop and report with a concrete “what’s blocking”.
- If you find that enrichment depends on data not available client-side without re-fetching core roster, stop and propose a revised seam that re-fetches only enrichment server-side.

## Maintenance notes

- Future enrichment fields should be added to the enrichment module interface, not re-created in UI panels.
- Keep the route payload versioned if you change schema (to avoid client/server drift).

