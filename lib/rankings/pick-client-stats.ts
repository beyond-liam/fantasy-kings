import {
  getStatColumns,
  POSITION_FILTERS,
  type PositionFilter,
} from "@/lib/rankings/column-config";

const RANK_KEYS = [
  "pos_rank_ppr",
  "pos_rank_std",
  "pos_adp_dd_ppr",
  "pos_rank_half_ppr",
] as const;

/** Extra Sleeper keys read by display helpers (not column config keys). */
const HELPER_STAT_KEYS = [
  "adp_ppr",
  "adp_dd_ppr",
  "adp_half_ppr",
  "adp_std",
  "adp_idp",
  "adp_idp_1qb",
  "pts_ppr",
  "pts_std",
  "pts_half_ppr",
  // Game Centre box score
  "pass_cmp",
  "pass_att",
  "pass_yd",
  "pass_td",
  "pass_int",
  "rush_att",
  "rush_yd",
  "rush_td",
  "rec",
  "rec_yd",
  "rec_td",
  "rec_tgt",
  "fum",
  "fum_lost",
  "pass_2pt",
  "rush_2pt",
  "rec_2pt",
  "fgm_0_19",
  "fgm_20_29",
  "fgm_30_39",
  "fgm_40_49",
  "fgm_50p",
  "fgm",
  "fgmiss",
  "xpm",
  "xpmiss",
  "tkl",
  "tkl_solo",
  "tkl_ast",
  "sack",
  "tkl_loss",
  "int",
  "ff",
  "fum_rec",
  "def_td",
  "blk_punt",
  "blk_kick",
  "safe",
  "def_kr_td",
  "pr_td",
  "st_td",
  "def_kr_yd",
  "def_pr_yd",
  "kr_yd",
  "pr_yd",
  // Sleeper IDP-prefixed keys (also aliased in normalizePlayerStats)
  "idp_tkl_solo",
  "idp_tkl_ast",
  "idp_tkl_loss",
  "idp_sack",
  "idp_ff",
  "idp_fum_rec",
  "idp_int",
  "idp_safe",
  "idp_def_td",
  "idp_td",
  "idp_tkl",
] as const;

/** Stat keys needed for table columns across all positions + position ranks. */
export function clientStatAllowlist(): Set<string> {
  const keys = new Set<string>([...RANK_KEYS, ...HELPER_STAT_KEYS]);
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
