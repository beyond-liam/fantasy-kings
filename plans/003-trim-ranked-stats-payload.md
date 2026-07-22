# Plan 003: Trim `stats` keys on ranked player client DTOs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5b6e84a0e4895a6a3978ffca7b458953f803c968..HEAD -- lib/queries/players.ts lib/rankings/column-config.ts lib/leagues/scoring/`
> If mismatch vs Current state, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: ideally after `plans/002-server-filter-rankings.md` (smaller row sets make verification easier); can ship alone
- **Category**: perf
- **Planned at**: commit `5b6e84a`, 2026-07-14

## Why this matters

`getRankedPlayers` selects full Sleeper `stats` JSONB and ships it on every `RankedPlayerRow` to client tables. Scoring and columns only need a small key set; the rest inflates RSC payloads (especially draft’s full pool). Trim **after** normalize + score, so CPU scoring still sees complete normalized stats, but the returned DTO only keeps display/rank keys.

## Current state

Select + map ships raw/normalized stats wholesale:

```84:122:lib/queries/players.ts
      stats: playerScores.stats,
      // ...
  const mapped = rows.map((row) => ({
    ...row,
    stats: normalizePlayerStats(
      (row.stats ?? {}) as Record<string, number | null>,
    ),
    fantasyPts: null as number | null,
    positionRank: null as number | null,
  }));

  return attachPositionRanks(applyScoring(mapped, filters));
```

`attachPositionRanks` reads:

- `pos_rank_ppr`, `pos_rank_std`, `pos_adp_dd_ppr`, `pos_rank_half_ppr`

Tables read column keys from `getStatColumns(position)` (`lib/rankings/column-config.ts:239-254`) — keys like `rush_yd`, `pass_td`, `adp`, `fantasy_pts` (fantasy_pts comes from `fantasyPts` field, not stats).

`calculatePlayerPoints` uses keys via `resolveSleeperStatKey` / distance keys — must run **before** pick.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `pnpm test` | all pass including new unit test |
| Lint | `pnpm lint` | exit 0 |

## Scope

**In scope**:
- `lib/queries/players.ts` (pick helper + apply on return path)
- New: `lib/rankings/pick-client-stats.ts` (pure helper) + `lib/rankings/pick-client-stats.test.ts`
- `package.json` `test` script — append the new test file path
- `plans/README.md`

**Out of scope**:
- Changing DB select (keep selecting full JSONB; pick in JS after score)
- Removing `stats` entirely from the type (columns still need a slim map)
- Persisted fantasy points cache

## Git workflow

- Branch: `advisor/003-trim-ranked-stats`
- Commit: `Trim ranked player stats before client serialization`
- Do NOT push/PR unless asked.

## Steps

### Step 1: Build the allowlist helper

Create `lib/rankings/pick-client-stats.ts`:

```ts
import { getStatColumns, POSITION_FILTERS, type PositionFilter } from "@/lib/rankings/column-config";

const RANK_KEYS = [
  "pos_rank_ppr",
  "pos_rank_std",
  "pos_adp_dd_ppr",
  "pos_rank_half_ppr",
] as const;

/** Stat keys needed for table columns across all positions + position ranks. */
export function clientStatAllowlist(): Set<string> {
  const keys = new Set<string>(RANK_KEYS);
  for (const position of POSITION_FILTERS) {
    for (const column of getStatColumns(position as PositionFilter)) {
      if (column.key !== "fantasy_pts") {
        keys.add(column.key);
      }
    }
  }
  return keys;
}

export function pickClientStats(
  stats: Record<string, number | null>,
  allowlist: Set<string> = clientStatAllowlist(),
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const key of allowlist) {
    if (key in stats) {
      out[key] = stats[key] ?? null;
    }
  }
  return out;
}
```

**Verify**: module imports cleanly; no circular import (column-config must not import players).

### Step 2: Unit test

Create `lib/rankings/pick-client-stats.test.ts` modeled on `lib/leagues/season-calendar.test.ts`:

- Assert `pickClientStats` keeps `pass_yd` / `pos_rank_ppr` and drops a junk key like `some_unused_sleeper_field`.
- Assert allowlist size is finite and includes `adp`.

Add to `package.json` `test` script list.

**Verify**: `pnpm exec tsx --test lib/rankings/pick-client-stats.test.ts` → pass.

### Step 3: Apply pick after scoring + ranks

In `lib/queries/players.ts`, after `attachPositionRanks(applyScoring(...))`, map rows to replace `stats` with `pickClientStats(row.stats)`.

Critical order:

1. `normalizePlayerStats`
2. `applyScoring` (needs full normalized stats)
3. `attachPositionRanks` (needs rank keys still present)
4. **then** `pickClientStats`

Implementation sketch:

```ts
const ranked = attachPositionRanks(applyScoring(mapped, filters));
const allowlist = clientStatAllowlist();
return ranked.map((row) => ({
  ...row,
  stats: pickClientStats(row.stats, allowlist),
}));
```

Reuse one `allowlist` Set per call (not per row).

**Verify**: `rg "pickClientStats" lib/queries/players.ts` → used once on return path.

### Step 4: Mark DONE

## Test plan

- New tests in `lib/rankings/pick-client-stats.test.ts` as above.
- `pnpm test` still green.

## Done criteria

- [ ] Returned `RankedPlayerRow.stats` only contains allowlisted keys
- [ ] Scoring still runs on full normalized stats before pick
- [ ] New unit tests pass and are wired into `pnpm test`
- [ ] Scope respected
- [ ] README DONE

## STOP conditions

- A UI column goes blank because its key was omitted — expand allowlist from `getStatColumns` / missing key; do not ship blanks.
- Discover code paths that read arbitrary stats keys outside column-config (e.g. trade analyzer) — STOP and list them before trimming globally.

## Maintenance notes

- When adding a stat column, update `column-config` only; allowlist rebuilds from it.
- Reviewer: verify draft pool and rankings still show ADP / rank / PTS.
