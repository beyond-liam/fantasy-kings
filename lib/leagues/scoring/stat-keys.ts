import type { ScoringCategory, ScoringRuleDefinition } from "@/lib/leagues/scoring/types";

const STAT_KEYS_BY_CATEGORY: Record<ScoringCategory, Record<string, string>> = {
  passing: {
    "Passing Completions": "pass_cmp",
    "Passing Yards": "pass_yd",
    "Passing TD": "pass_td",
    "Passing TDs (Quantity)": "pass_td",
    "Passing TDs (Distance)": "pass_td",
    "2 Pt Conversion Passing": "pass_2pt",
    "2 Pt Conversions Passing": "pass_2pt",
    Interception: "pass_int",
    Interceptions: "pass_int",
  },
  rushing: {
    "Rushing Attempts": "rush_att",
    "Rushing Yards": "rush_yd",
    "Rushing TD": "rush_td",
    "Rushing TDs (Quantity)": "rush_td",
    "Rushing TDs (Distance)": "rush_td",
    "2 Pt Conversion Rushing": "rush_2pt",
    "2 Pt Conversions Rushing": "rush_2pt",
  },
  receiving: {
    Catches: "rec",
    Reception: "rec",
    "Receiving Yards": "rec_yd",
    "Receiving TD": "rec_td",
    "Receiving TDs (Quantity)": "rec_td",
    "Receiving TDs (Distance)": "rec_td",
    "2 Pt Conversion Receiving": "rec_2pt",
    "2 Pt Conversions Receiving": "rec_2pt",
  },
  kicking: {
    "Field Goal Made": "fgm",
    "Field Goals Made (Quantity)": "fgm",
    "Field Goals Made (Distance)": "fgm",
    XP: "xpm",
    XPs: "xpm",
  },
  returning: {
    "Kick Return TD": "def_kr_td",
    "Kick Return TDs (Quantity)": "def_kr_td",
    "Kick Return TDs (Distance)": "def_kr_td",
    "Punt Return TD": "pr_td",
    "Punt Return TDs (Quantity)": "pr_td",
    "Punt Return TDs (Distance)": "pr_td",
  },
  defense: {
    "Solo Tackle": "tkl_solo",
    "Solo Tackles": "tkl_solo",
    Interception: "int",
    Interceptions: "int",
    Sack: "sack",
    Sacks: "sack",
    "Fumble Forced": "ff",
    "Fumbles Forced": "ff",
    "Fumble Recovered": "fum_rec",
    "Fumbles Recovered": "fum_rec",
    Safety: "safe",
    Safeties: "safe",
    "Defensive TD": "def_td",
    "Defensive TDs (Quantity)": "def_td",
    "Defensive TDs (Distance)": "def_td",
    "Conversion Return": "def_st_td",
    "Conversion Returns": "def_st_td",
    "Points Allowed": "pts_allow",
  },
  misc: {
    Fumble: "fum",
    Fumbles: "fum",
    "Fumble Lost": "fum_lost",
    "Fumbles Lost": "fum_lost",
    "Offensive Fumble Recovery TD": "fum_rec_td",
    "Offensive Fumble Recovery TDs (Quantity)": "fum_rec_td",
    "Offensive Fumble Recovery TDs (Distance)": "fum_rec_td",
  },
};

export function resolveSleeperStatKey(
  rule: Pick<ScoringRuleDefinition, "stat" | "category">,
): string | null {
  return STAT_KEYS_BY_CATEGORY[rule.category]?.[rule.stat] ?? null;
}

export function resolveDistanceStatKey(
  rule: ScoringRuleDefinition,
): string | null {
  const baseKey = resolveSleeperStatKey(rule);
  if (!baseKey) {
    return null;
  }

  if (baseKey === "fgm") {
    if (rule.kind === "td_min_yards" && (rule.minYards ?? 0) >= 50) {
      return "fgm_50p";
    }

    if (
      rule.kind === "td_range" &&
      rule.minYards === 40 &&
      rule.maxYards === 49
    ) {
      return "fgm_40_49";
    }
  }

  if (rule.kind === "exact" && rule.stat === "Points Allowed") {
    if (rule.exactValue === 0) {
      return "pts_allow_0";
    }
  }

  return null;
}
