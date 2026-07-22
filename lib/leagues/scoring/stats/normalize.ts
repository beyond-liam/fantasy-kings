import type {
  ScoringCategory,
  ScoringRuleDefinition,
  ScoringRuleKind,
} from "@/lib/leagues/scoring/types";

const DISTANCE_KINDS = new Set<ScoringRuleKind>([
  "td_range",
  "td_min_yards",
  "td_max_yards",
  "yards_per_every",
  "yards_per_every_after",
  "yards_per_every_up_to",
  "yards_per_every_between",
]);

/**
 * Map stored/preset rule labels onto the catalog Stat dropdown labels.
 * Each catalog label is one picker option — once any rule uses it, that option
 * should be disabled so the same rule cannot be added twice.
 */
const CATALOG_STAT_BY_CATEGORY: Partial<
  Record<ScoringCategory, Record<string, string>>
> = {
  passing: {
    "Passing Completions": "Passing Completions",
    "Passing Completions of 20+ Yards": "Passing Completions of 20+ Yards",
    "Passing Completions of 40+ Yards": "Passing Completions of 40+ Yards",
    "Passing Completions of 60+ Yards": "Passing Completions of 60+ Yards",
    "Passing Attempts": "Passing Attempts",
    "Incomplete Passes": "Incomplete Passes",
    "Dropped Passes": "Dropped Passes",
    "Completion Percentage": "Completion Percentage",
    "Passing Yards": "Passing Yards",
    "Yard Per Attempt": "Yard Per Attempt",
    "Passing TD": "Passing TDs (Quantity)",
    "Passing TDs (Quantity)": "Passing TDs (Quantity)",
    "Passing TDs (Distance)": "Passing TDs (Distance)",
    "2 Pt Conversion Passing": "2 Pt Conversions Passing",
    "2 Pt Conversions Passing": "2 Pt Conversions Passing",
    Interception: "Interceptions",
    Interceptions: "Interceptions",
    "Interceptions For TD": "Interceptions For TD",
    "Times Sacked": "Times Sacked",
    "Sacked Yards": "Sacked Yards",
    "QB Rating": "QB Rating",
    "Passing First Downs": "Passing First Downs",
  },
  rushing: {
    "Rushing Attempts": "Rushing Attempts",
    "Rushing Attempts of 20+ Yards": "Rushing Attempts of 20+ Yards",
    "Rushing Attempts of 40+ Yards": "Rushing Attempts of 40+ Yards",
    "Rushing Attempts of 60+ Yards": "Rushing Attempts of 60+ Yards",
    "Rushing Yards": "Rushing Yards",
    "Yard Per Attempt": "Yard Per Attempt",
    "2 Pt Conversion Rushing": "2 Pt Conversions Rushing",
    "2 Pt Conversions Rushing": "2 Pt Conversions Rushing",
    "Rushing TD": "Rushing TDs (Quantity)",
    "Rushing TDs (Quantity)": "Rushing TDs (Quantity)",
    "Rushing TDs (Distance)": "Rushing TDs (Distance)",
    "Rushing First Downs": "Rushing First Downs",
  },
  receiving: {
    Catches: "Catches",
    Reception: "Catches",
    "Catches of 20+ Yards": "Catches of 20+ Yards",
    "Catches of 40+ Yards": "Catches of 40+ Yards",
    "Catches of 60+ Yards": "Catches of 60+ Yards",
    Targets: "Targets",
    "Target % Caught": "Target % Caught",
    Drops: "Drops",
    "Receiving Yards": "Receiving Yards",
    "Yards After Catch": "Yards After Catch",
    "Yard Per Reception": "Yard Per Reception",
    "2 Pt Conversion Receiving": "2 Pt Conversions Receiving",
    "2 Pt Conversions Receiving": "2 Pt Conversions Receiving",
    "Receiving TD": "Receiving TDs (Quantity)",
    "Receiving TDs (Quantity)": "Receiving TDs (Quantity)",
    "Receiving TDs (Distance)": "Receiving TDs (Distance)",
    "Receiving First Downs": "Receiving First Downs",
  },
  kicking: {
    "Field Goal Made": "Field Goals Made (Quantity)",
    "Field Goals Made (Quantity)": "Field Goals Made (Quantity)",
    "Field Goals Made (Distance)": "Field Goals Made (Distance)",
    "Field Goal Missed (Quantity)": "Field Goal Missed (Quantity)",
    "Field Goals Missed (Distance)": "Field Goals Missed (Distance)",
    "Field Goal Attempts": "Field Goal Attempts",
    "FG Percentage": "FG Percentage",
    XP: "XPs",
    XPs: "XPs",
    "XPs Missed": "XPs Missed",
    "Extra Point Attempts": "Extra Point Attempts",
    "XP Percentage": "XP Percentage",
  },
  returning: {
    "Kick Return Attempts": "Kick Return Attempts",
    "Kick Return Yards": "Kick Return Yards",
    "Kick Return TD": "Kick Return TDs (Quantity)",
    "Kick Return TDs (Quantity)": "Kick Return TDs (Quantity)",
    "Kick Return TDs (Distance)": "Kick Return TDs (Distance)",
    "Punt Return Attempts": "Punt Return Attempts",
    "Punt Return Yards": "Punt Return Yards",
    "Punt Return TD": "Punt Return TDs (Quantity)",
    "Punt Return TDs (Quantity)": "Punt Return TDs (Quantity)",
    "Punt Return TDs (Distance)": "Punt Return TDs (Distance)",
  },
  defense: {
    "Assisted Tackles": "Assisted Tackles",
    "Solo Tackle": "Solo Tackles",
    "Solo Tackles": "Solo Tackles",
    "Tackles For Loss": "Tackles For Loss",
    Interception: "Interceptions",
    Interceptions: "Interceptions",
    Sack: "Sacks",
    Sacks: "Sacks",
    "Sack Yards": "Sack Yards",
    "Fumble Forced": "Fumbles Forced",
    "Fumbles Forced": "Fumbles Forced",
    "Fumble Recovered": "Fumbles Recovered",
    "Fumbles Recovered": "Fumbles Recovered",
    "Opposing Fumble Recoveries": "Opposing Fumble Recoveries",
    Safety: "Safeties",
    Safeties: "Safeties",
    "Defensive TD": "Defensive TDs (Quantity)",
    "Defensive TDs (Quantity)": "Defensive TDs (Quantity)",
    "Defensive TDs (Distance)": "Defensive TDs (Distance)",
    "Conversion Return": "Conversion Returns",
    "Conversion Returns": "Conversion Returns",
    "Points Allowed": "Points Allowed",
  },
  misc: {
    Fumble: "Fumbles",
    Fumbles: "Fumbles",
    "Fumble Lost": "Fumbles Lost",
    "Fumbles Lost": "Fumbles Lost",
    "Fumbles Lost for TD": "Fumbles Lost for TD",
    "Own Fumble Recoveries": "Own Fumble Recoveries",
    "Offensive Fumble Recovery TD": "Offensive Fumble Recovery TDs (Quantity)",
    "Offensive Fumble Recovery TDs (Quantity)":
      "Offensive Fumble Recovery TDs (Quantity)",
    "Offensive Fumble Recovery TDs (Distance)":
      "Offensive Fumble Recovery TDs (Distance)",
  },
};

/** Stats that split into Quantity vs Distance based on rule kind. */
const QUANTITY_DISTANCE_SPLIT: Partial<
  Record<ScoringCategory, Record<string, { quantity: string; distance: string }>>
> = {
  passing: {
    "Passing TD": {
      quantity: "Passing TDs (Quantity)",
      distance: "Passing TDs (Distance)",
    },
    "Passing TDs (Quantity)": {
      quantity: "Passing TDs (Quantity)",
      distance: "Passing TDs (Distance)",
    },
    "Passing TDs (Distance)": {
      quantity: "Passing TDs (Quantity)",
      distance: "Passing TDs (Distance)",
    },
  },
  rushing: {
    "Rushing TD": {
      quantity: "Rushing TDs (Quantity)",
      distance: "Rushing TDs (Distance)",
    },
    "Rushing TDs (Quantity)": {
      quantity: "Rushing TDs (Quantity)",
      distance: "Rushing TDs (Distance)",
    },
    "Rushing TDs (Distance)": {
      quantity: "Rushing TDs (Quantity)",
      distance: "Rushing TDs (Distance)",
    },
  },
  receiving: {
    "Receiving TD": {
      quantity: "Receiving TDs (Quantity)",
      distance: "Receiving TDs (Distance)",
    },
    "Receiving TDs (Quantity)": {
      quantity: "Receiving TDs (Quantity)",
      distance: "Receiving TDs (Distance)",
    },
    "Receiving TDs (Distance)": {
      quantity: "Receiving TDs (Quantity)",
      distance: "Receiving TDs (Distance)",
    },
  },
  kicking: {
    "Field Goal Made": {
      quantity: "Field Goals Made (Quantity)",
      distance: "Field Goals Made (Distance)",
    },
    "Field Goals Made (Quantity)": {
      quantity: "Field Goals Made (Quantity)",
      distance: "Field Goals Made (Distance)",
    },
    "Field Goals Made (Distance)": {
      quantity: "Field Goals Made (Quantity)",
      distance: "Field Goals Made (Distance)",
    },
  },
  returning: {
    "Kick Return TD": {
      quantity: "Kick Return TDs (Quantity)",
      distance: "Kick Return TDs (Distance)",
    },
    "Kick Return TDs (Quantity)": {
      quantity: "Kick Return TDs (Quantity)",
      distance: "Kick Return TDs (Distance)",
    },
    "Kick Return TDs (Distance)": {
      quantity: "Kick Return TDs (Quantity)",
      distance: "Kick Return TDs (Distance)",
    },
    "Punt Return TD": {
      quantity: "Punt Return TDs (Quantity)",
      distance: "Punt Return TDs (Distance)",
    },
    "Punt Return TDs (Quantity)": {
      quantity: "Punt Return TDs (Quantity)",
      distance: "Punt Return TDs (Distance)",
    },
    "Punt Return TDs (Distance)": {
      quantity: "Punt Return TDs (Quantity)",
      distance: "Punt Return TDs (Distance)",
    },
  },
  defense: {
    "Defensive TD": {
      quantity: "Defensive TDs (Quantity)",
      distance: "Defensive TDs (Distance)",
    },
    "Defensive TDs (Quantity)": {
      quantity: "Defensive TDs (Quantity)",
      distance: "Defensive TDs (Distance)",
    },
    "Defensive TDs (Distance)": {
      quantity: "Defensive TDs (Quantity)",
      distance: "Defensive TDs (Distance)",
    },
  },
  misc: {
    "Offensive Fumble Recovery TD": {
      quantity: "Offensive Fumble Recovery TDs (Quantity)",
      distance: "Offensive Fumble Recovery TDs (Distance)",
    },
    "Offensive Fumble Recovery TDs (Quantity)": {
      quantity: "Offensive Fumble Recovery TDs (Quantity)",
      distance: "Offensive Fumble Recovery TDs (Distance)",
    },
    "Offensive Fumble Recovery TDs (Distance)": {
      quantity: "Offensive Fumble Recovery TDs (Quantity)",
      distance: "Offensive Fumble Recovery TDs (Distance)",
    },
  },
};

export function normalizeRuleToCatalogStat(
  rule: Pick<ScoringRuleDefinition, "category" | "stat" | "kind">,
): string {
  const split = QUANTITY_DISTANCE_SPLIT[rule.category]?.[rule.stat];
  if (split) {
    return DISTANCE_KINDS.has(rule.kind) ? split.distance : split.quantity;
  }

  return (
    CATALOG_STAT_BY_CATEGORY[rule.category]?.[rule.stat] ?? rule.stat
  );
}

/** Legacy preset kinds → Rule type dropdown kinds. */
const LEGACY_KIND_TO_CATALOG: Partial<Record<ScoringRuleKind, ScoringRuleKind>> =
  {
    simple: "per_every",
    per_unit: "per_every",
  };

export function normalizeRuleToCatalogKind(
  kind: ScoringRuleKind,
): ScoringRuleKind {
  return LEGACY_KIND_TO_CATALOG[kind] ?? kind;
}

export function normalizeRuleToCatalogCombo(
  rule: Pick<ScoringRuleDefinition, "category" | "stat" | "kind">,
): { stat: string; kind: ScoringRuleKind } {
  return {
    stat: normalizeRuleToCatalogStat(rule),
    kind: normalizeRuleToCatalogKind(rule.kind),
  };
}

export function getCatalogComboKey(
  combo: Pick<{ stat: string; kind: ScoringRuleKind }, "stat" | "kind">,
): string {
  return `${combo.stat}::${combo.kind}`;
}

export function getUsedCatalogCombos(
  rules: Pick<ScoringRuleDefinition, "id" | "category" | "stat" | "kind">[],
  options: {
    category: ScoringCategory;
    excludeRuleId?: string;
  },
): Set<string> {
  const used = new Set<string>();
  for (const rule of rules) {
    if (rule.category !== options.category) {
      continue;
    }
    if (options.excludeRuleId && rule.id === options.excludeRuleId) {
      continue;
    }
    used.add(getCatalogComboKey(normalizeRuleToCatalogCombo(rule)));
  }
  return used;
}

/** @deprecated Prefer getUsedCatalogCombos — kept for any residual callers. */
export function getUsedCatalogStats(
  rules: Pick<ScoringRuleDefinition, "id" | "category" | "stat" | "kind">[],
  options: {
    category: ScoringCategory;
    excludeRuleId?: string;
  },
): Set<string> {
  const used = new Set<string>();
  for (const key of getUsedCatalogCombos(rules, options)) {
    used.add(key.split("::")[0]);
  }
  return used;
}
