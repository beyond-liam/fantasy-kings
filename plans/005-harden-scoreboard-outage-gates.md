# Plan 005: Harden scoreboard outage gates (final + nflverse)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- lib/queries/week-matchup-board.ts app/api/cron/sync-scores/route.ts lib/scores/`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/003-characterize-score-sync-finalize.md` (004 optional but recommended first)
- **Category**: bug
- **Planned at**: commit `73a83c2`, 2026-07-27

## Why this matters

Two failure modes share one root cause: treating a missing ESPN scoreboard as an empty/complete slate.

1. `allStartersFinal` returns true when a starter's NFL team has **no** progress entry (`progress == null`), so an outage can mark live matchups `final`.
2. Cron auto-runs nflverse replace when `games.length === 0` after a failed fetch, which can overwrite live Sleeper/ESPN stats mid-week (`syncNflverseWeekScores` replaces stats).

## Current state

`lib/queries/week-matchup-board.ts:218-228`:

```ts
function allStartersFinal(...) {
  if (lineup.length === 0) return false;
  return lineup.every((player) => {
    const abbrev = normalizeNflTeamAbbrev(player.nflTeam);
    if (!abbrev) return true;
    const progress = progressByNflTeam.get(abbrev);
    return progress == null || progress.status === "post";
  });
}
```

`app/api/cron/sync-scores/route.ts:89-97`:

```ts
const board = await getNflScoreboard(...).catch(() => null);
const games = board?.games ?? [];
const hasLive = games.some((game) => game.status === "in");
const hasPost = games.some((game) => game.status === "post");
shouldRunNflverse = !hasLive && (hasPost || games.length === 0);
```

Plan 003 should have locked these as "current behavior" tests to flip.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `pnpm test` / `pnpm test:db` | flipped assertions pass |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |

## Scope

**In scope**:
- `lib/queries/week-matchup-board.ts` — `allStartersFinal` (and any callers that assume missing = final)
- `lib/scores/nflverse-run-gate.ts` (or wherever plan 003 put the helper) + `app/api/cron/sync-scores/route.ts`
- Tests from plan 003 that locked the bugs

**Out of scope**:
- Lineup snapshot / official corrections (006)
- Changing Sleeper/ESPN sync upsert logic itself
- Adding retries/backoff frameworks

## Git workflow

- Branch: `advisor/005-harden-scoreboard-outage-gates`
- Commit message example: `Treat missing scoreboard progress as not final and gate nflverse replace.`
- Do NOT push unless instructed.

## Steps

### Step 1: Missing progress is not final

Change `allStartersFinal` so that for a starter with a known NFL abbrev:

- `progress == null` → **not** final (`false` for that player / overall)
- `progress.status === "post"` → final
- `progress.status === "in"` or `"pre"` (or anything else) → not final

Keep: unknown/empty abbrev behavior as today (`return true` for that player) **unless** tests show that path finalizes empty lineups incorrectly — empty lineup already returns false.

Flip plan-003 test from "missing progress as final" to "missing progress as not final".

**Verify**: `pnpm test -- lib/queries/week-matchup-board` passes

### Step 2: Require successful scoreboard for auto nflverse

Update `shouldAutoRunNflverse` (or inline equivalent):

- `force` → true
- if `!scoreboardOk` → **false** (do not auto-run)
- if any `status === "in"` → false
- else if every game is `post` (and `games.length > 0`) → true
- empty games with `scoreboardOk` → false (do not treat empty as complete)

Explicit `nflverse=1` force path remains.

Wire route:

```ts
const board = await getNflScoreboard(...).catch(() => null);
shouldRunNflverse = shouldAutoRunNflverse({
  force: forceNflverse,
  scoreboardOk: board != null,
  games: board?.games ?? [],
});
```

Flip plan-003 tests accordingly.

**Verify**: `pnpm test -- lib/scores` passes

### Step 3: Sanity on finalize interaction

Manually reason (and if cheap, add a unit case): when scoreboard fetch fails inside finalize's `gamesForWeek` (returns `[]`), matchups must **not** become `final` solely due to empty progress. Step 1 should already ensure that. If finalize has a separate path that marks final without `allStartersFinal`, STOP and report.

**Verify**: `pnpm test` + `pnpm test:db` exit 0

## Test plan

- Missing progress → not final
- Mixed post + missing → not final
- All post → final
- nflverse: scoreboardOk false → false
- nflverse: empty games + ok → false
- nflverse: all post → true
- nflverse: force → true even if not ok

## Done criteria

- [ ] `allStartersFinal` no longer treats `progress == null` as final for known teams
- [ ] Auto nflverse requires successful scoreboard and a non-empty all-`post` slate (or force)
- [ ] Characterization tests updated and green
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` exit 0
- [ ] `plans/README.md` 005 → DONE

## STOP conditions

- Finalize uses a different final heuristic that still treats empty boards as final after step 1
- Plan 003 helpers/tests are absent
- Changing bye-week / DEF team abbrev edge cases is unclear — stop with the fixture rather than guessing

## Maintenance notes

- Stricter finals delay standings until ESPN recovers — acceptable vs wrong finals
- Reviewer: confirm forced `nflverse=1` still works for ops recovery
