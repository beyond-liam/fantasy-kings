import type { PlayerStatBag } from "@/lib/leagues/scoring/calculate";
import { playerWeekHasFantasyAppearance } from "@/lib/players/week-appearance";

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

/** Sleeper IDP projection/stat keys → shared defense keys used by scoring + tables. */
const IDP_STAT_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ["idp_tkl_solo", "tkl_solo"],
  ["idp_tkl_ast", "tkl_ast"],
  ["idp_tkl", "tkl"],
  ["idp_tkl_loss", "tkl_loss"],
  ["idp_sack", "sack"],
  ["idp_ff", "ff"],
  ["idp_fum_rec", "fum_rec"],
  ["idp_int", "int"],
  ["idp_safe", "safe"],
  ["idp_def_td", "def_td"],
  ["idp_td", "def_td"],
];

/**
 * Counting keys shown in player tables/tiles. Providers often omit zeros;
 * when the bag is a real appearance we fill absent keys with 0 so UI can
 * distinguish "zero" from "no data" (—).
 */
const COUNTING_STAT_KEYS = [
  "pass_cmp",
  "pass_att",
  "pass_yd",
  "pass_td",
  "pass_int",
  "pass_2pt",
  "rush_att",
  "rush_yd",
  "rush_td",
  "rush_2pt",
  "rec",
  "rec_tgt",
  "rec_yd",
  "rec_td",
  "rec_2pt",
  "fum",
  "fum_lost",
  "fgm",
  "fga",
  "fgmiss",
  "xpm",
  "xpa",
  "xpmiss",
  "fgm_0_19",
  "fgm_20_29",
  "fgm_30_39",
  "fgm_40_49",
  "fgm_50p",
  "fgmiss_0_19",
  "fgmiss_20_29",
  "fgmiss_30_39",
  "fgmiss_40_49",
  "fgmiss_50p",
  "tkl",
  "tkl_solo",
  "tkl_ast",
  "tkl_loss",
  "sack",
  "int",
  "ff",
  "fum_rec",
  "def_td",
  "safe",
  "blk_punt",
  "blk_kick",
  "def_kr_td",
  "pr_td",
  "st_td",
  "def_kr_yd",
  "def_pr_yd",
  "kr_yd",
  "pr_yd",
  "pts_allow",
  "yds_allow",
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
 *
 * IDP rows use `idp_*` keys (e.g. `idp_sack`); alias those onto the shared
 * defense keys scoring rules and rankings columns already expect.
 *
 * When the bag is a real fantasy appearance, fill omitted counting keys with
 * `0` so tables/tiles show zero instead of a missing-data dash.
 */
export function normalizePlayerStats(stats: PlayerStatBag): PlayerStatBag {
  const next: PlayerStatBag = { ...stats };

  for (const [fromKey, toKey] of IDP_STAT_ALIASES) {
    if (!hasNumericStat(next, toKey) && hasNumericStat(next, fromKey)) {
      next[toKey] = next[fromKey];
    }
  }

  // Total tackles = solo + assist when not already provided (e.g. Sleeper idp_tkl).
  if (!hasNumericStat(next, "tkl")) {
    const hasSolo = hasNumericStat(next, "tkl_solo");
    const hasAst = hasNumericStat(next, "tkl_ast");
    if (hasSolo || hasAst) {
      next.tkl =
        (hasSolo ? (next.tkl_solo as number) : 0) +
        (hasAst ? (next.tkl_ast as number) : 0);
    }
  }

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

  if (playerWeekHasFantasyAppearance(next)) {
    for (const key of COUNTING_STAT_KEYS) {
      if (!hasNumericStat(next, key)) {
        next[key] = 0;
      }
    }
  }

  return next;
}
