import type { PlayerStatBag } from "@/lib/leagues/scoring/calculate";

const FG_MADE_BUCKETS = [
  "fgm_0_19",
  "fgm_20_29",
  "fgm_30_39",
  "fgm_40_49",
  "fgm_50p",
] as const;

const FG_MISS_BUCKETS = [
  "fgmiss_0_19",
  "fgmiss_20_29",
  "fgmiss_30_39",
  "fgmiss_40_49",
  "fgmiss_50p",
] as const;

function sumStatKeys(
  stats: PlayerStatBag,
  keys: readonly string[],
): number {
  let total = 0;
  let sawAny = false;
  for (const key of keys) {
    const value = stats[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      total += value;
      sawAny = true;
    }
  }
  return sawAny ? total : 0;
}

function hasNumericStat(stats: PlayerStatBag, key: string): boolean {
  const value = stats[key];
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Sleeper season kicker projections often omit totals (`fgm` / `fga` / `xpa`)
 * and only publish distance buckets. Derive the missing aggregates so scoring
 * and table columns work when those buckets exist.
 */
export function normalizePlayerStats(stats: PlayerStatBag): PlayerStatBag {
  const next: PlayerStatBag = { ...stats };

  const madeFromBuckets = sumStatKeys(next, FG_MADE_BUCKETS);
  const missFromBuckets = sumStatKeys(next, FG_MISS_BUCKETS);

  if (!hasNumericStat(next, "fgm") && madeFromBuckets > 0) {
    next.fgm = madeFromBuckets;
  }

  if (!hasNumericStat(next, "fga")) {
    const made = hasNumericStat(next, "fgm")
      ? (next.fgm as number)
      : madeFromBuckets;
    if (made > 0 || missFromBuckets > 0) {
      next.fga = made + missFromBuckets;
    }
  }

  if (!hasNumericStat(next, "xpa")) {
    const xpm = hasNumericStat(next, "xpm") ? (next.xpm as number) : 0;
    const xpmiss = hasNumericStat(next, "xpmiss")
      ? (next.xpmiss as number)
      : 0;
    if (xpm > 0 || xpmiss > 0) {
      next.xpa = xpm + xpmiss;
    }
  }

  return next;
}
