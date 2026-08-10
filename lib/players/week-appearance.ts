/**
 * Sleeper (and similar) often ship placeholder weekly score rows for inactive
 * players — rank metadata only, no counting stats. Those calculate as 0 FPts
 * and must not be treated as real appearances (they should be DNP).
 */
const APPEARANCE_KEYS = [
  "gp",
  "off_snp",
  "def_snp",
  "st_snp",
  "pass_att",
  "pass_yd",
  "pass_td",
  "pass_int",
  "rush_att",
  "rush_yd",
  "rush_td",
  "rec",
  "rec_tgt",
  "rec_yd",
  "rec_td",
  "fum",
  "fum_lost",
  "fgm",
  "fgmiss",
  "xpm",
  "xpmiss",
  "pts_allow",
  "yds_allow",
  "sack",
  "int",
  "fum_rec",
  "def_td",
  "safe",
  "blk_kick",
  "ff",
  "tkl",
  "tkl_solo",
  "tkl_ast",
  "tkl_loss",
  // Raw Sleeper IDP keys (before normalize aliases onto shared defense keys)
  "idp_tkl",
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
  "pts_idp",
  "pts_ppr",
  "pts_std",
  "pts_half_ppr",
] as const;

const POSITIVE_ONLY = new Set(["gp", "off_snp", "def_snp", "st_snp"]);

export function playerWeekHasFantasyAppearance(
  stats: Record<string, number | null | undefined> | null | undefined,
): boolean {
  if (!stats) return false;
  for (const key of APPEARANCE_KEYS) {
    const value = stats[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (POSITIVE_ONLY.has(key)) {
      if (value > 0) return true;
      continue;
    }
    return true;
  }
  return false;
}
