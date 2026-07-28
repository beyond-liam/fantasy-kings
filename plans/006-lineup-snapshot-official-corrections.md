# Plan 006: Freeze lineups at finalize for official corrections

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 73a83c2..HEAD -- lib/leagues/matchups/finalize.ts lib/queries/week-matchup-board.ts lib/leagues/tiebreakers/ db/schema/`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/003-characterize-score-sync-finalize.md` (004/005 recommended first)
- **Category**: bug
- **Planned at**: commit `73a83c2`, 2026-07-27
- **Execution**: DONE 2026-07-28 (`advisor/006-lineup-snapshot-official-corrections-v2` @ 32b0f2a)

## Why this matters

With `applyOfficialStatChanges` defaulting to `true` (`lib/leagues/tiebreakers.ts`), already-final weeks are re-finalized every score sync. Enrichment reads **current** `rosterPlayers` (`week-matchup-board.ts:118-122`), not the lineup that played that week. Post-week roster edits (waivers, start/sit) can rewrite historical `homePts`/`awayPts` and W/L. Playoff game-tie metrics (`load-game-metrics.ts`) have the same live-roster dependency, so tied playoff games can be flipped by later lineup changes.

## Current state

- Default: `applyOfficialStatChanges: true` in `DEFAULT_TIEBREAKER_SETTINGS`
- Finalize loop re-enters final weeks when corrections allowed (`finalize.ts:332-371`)
- Points drift >0.05 overwrites persisted pts (`finalize.ts` correction path ~65–88)
- `getRosterPlayersForTeams` filters `status = 'rostered'` live rows only
- No week-scoped lineup snapshot table in schema today (confirm with `ls db/schema`)

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Generate migration | `pnpm db:generate` | new SQL under `db/migrations/` |
| Unit/DB tests | `pnpm test` / `pnpm test:db` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |

## Scope

**In scope**:
- Schema + migration for a **week lineup snapshot** (or equivalent) storing per team/week starter player IDs (and optionally slot) at finalize time
- Write snapshot when a matchup first becomes `final`
- Re-score corrections using snapshot player IDs + current `player_scores` stats (not live roster)
- Update `loadTeamWeekGameTieMetrics` (or its roster loader) to prefer snapshot for that week when present
- Tests proving: after finalize, changing live roster does not change final pts on correction pass; tie metrics use snapshot

**Out of scope**:
- Disabling `applyOfficialStatChanges` by default as the only fix (that hides the bug; optional commissioner toggle may remain)
- Rewriting the entire Game Centre live board to use snapshots for **current** week (live week should still use live roster)
- Backfilling historical seasons perfectly if data is gone — document limitation; only snapshot going forward is OK if backfill is impossible

## Git workflow

- Branch: `advisor/006-lineup-snapshot-official-corrections`
- Commit message example: `Snapshot starters at finalize so official corrections cannot rewrite history from live rosters.`
- Do NOT push unless instructed.

## Steps

### Step 1: Design the minimal snapshot shape

Preferred minimal table (names may match repo conventions):

- `team_week_lineups` (or `matchup_lineup_snapshots`)
- Columns: `id`, `leagueSeasonId`, `teamId`, `week`, `playerId`, `slotPositionId` (nullable ok), `createdAt`
- Unique: `(leagueSeasonId, teamId, week, playerId)` or store JSON starter IDs on `matchups` — **prefer relational** if other queries need joins

If adding JSON on `matchups` (`homeStarterPlayerIds`, `awayStarterPlayerIds`) is dramatically smaller and sufficient, that is acceptable — pick one approach and document it in the migration comment.

**Verify**: `pnpm db:generate` produces a migration; `pnpm typecheck` after schema update

### Step 2: Persist snapshot on first finalize

When transitioning a matchup to `status: "final"`, write starter IDs used for that score. Idempotent: if snapshot exists, do not replace from live roster on later correction passes.

**Verify**: dbtest — finalize once, mutate roster, re-run finalize with corrections on, pts unchanged when stats unchanged

### Step 3: Correction path reads snapshot

When re-scoring a final week, load starters from snapshot. If snapshot missing (legacy row), either:

- skip correction for that matchup (safest), or
- one-time fill from live roster only when snapshot empty **and** log a warning

Prefer skip/legacy-no-op over rewriting history.

**Verify**: dbtest named for legacy missing snapshot behavior

### Step 4: Playoff tie metrics use the same snapshot

Update `lib/leagues/tiebreakers/load-game-metrics.ts` to score the week's locked starters when snapshot exists.

**Verify**: unit/dbtest — change live roster after final → metrics unchanged

### Step 5: Spec note

Add a one-line changelog entry in `docs/PROJECT_SPEC.md` under changelog: official corrections re-score frozen starters.

**Verify**: doc updated; no contradiction with §1b scoring bullets

## Test plan

Model after `lib/leagues/trades/lifecycle.dbtest.ts`.

Cases:
1. First finalize writes snapshot
2. Live roster swap does not change finals on correction cron
3. Stat change for a snapshotted player **does** update pts when corrections on
4. Tie metrics ignore post-final roster edits
5. Current (non-final) week board still uses live roster (no snapshot required)

## Done criteria

- [ ] Snapshot persisted at finalize; corrections use it
- [ ] Playoff game-tie metrics prefer snapshot
- [ ] `pnpm db:generate` migration committed; `pnpm typecheck`, `pnpm test`, `pnpm test:db` exit 0
- [ ] PROJECT_SPEC changelog note
- [ ] `plans/README.md` 006 → DONE

## STOP conditions

- Schema approach requires multi-week historical reconstruction you cannot do safely — report and propose "snapshot forward only + skip corrections without snapshot"
- Fix seems to need rewriting all of Game Centre
- Migration conflicts with uncommitted local migrations

## Maintenance notes

- Reviewer: ensure live in-progress weeks still use live rosters
- Future: season rewind / HoF choke metrics may also want snapshots — out of scope here
- High risk: wrong freeze breaks intentional score fixes — tests must cover "stat changed, roster same → pts update"
