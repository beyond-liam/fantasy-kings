export type ScoringPreset = "standard" | "half_ppr" | "full_ppr";

export type ScoringCategory =
  | "passing"
  | "rushing"
  | "receiving"
  | "kicking"
  | "returning"
  | "defense"
  | "misc";

export type ScoringPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";

export type ScoringRuleKind =
  | "simple"
  | "per_unit"
  | "per_every"
  | "per_every_after"
  | "per_every_first"
  | "per_every_between"
  | "threshold"
  | "threshold_lte"
  | "threshold_between"
  | "yards_per_every"
  | "yards_per_every_after"
  | "yards_per_every_up_to"
  | "yards_per_every_between"
  | "td_range"
  | "td_min_yards"
  | "td_max_yards"
  | "exact";

export type ScoringRuleSegment =
  | { type: "text"; value: string; muted?: boolean }
  | { type: "points"; value: number }
  | { type: "stat"; value: string };

export type ScoringRuleDefinition = {
  id: string;
  category: ScoringCategory;
  kind: ScoringRuleKind;
  points: number;
  stat: string;
  every?: number;
  rate?: number;
  threshold?: number;
  maxThreshold?: number;
  minYards?: number;
  maxYards?: number;
  exactValue?: number;
  positions: ScoringPosition[];
};

export type ScoringRule = ScoringRuleDefinition & {
  segments: ScoringRuleSegment[];
};

export const OFFENSE_SCORING_POSITIONS: ScoringPosition[] = [
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
];

export const SCORING_POSITIONS: ScoringPosition[] = [
  ...OFFENSE_SCORING_POSITIONS,
  "DEF",
];

export const SCORING_RULE_KIND_OPTIONS: {
  value: ScoringRuleKind;
  label: string;
}[] = [
  { value: "per_every", label: "Points for every X of stat" },
  { value: "per_every_after", label: "Points for every X after reaching total" },
  { value: "per_every_first", label: "Points for every X for first total" },
  { value: "per_every_between", label: "Points for every X between totals" },
  { value: "threshold", label: "Bonus when total is at least threshold" },
  { value: "threshold_lte", label: "Bonus when total is at most threshold" },
  { value: "threshold_between", label: "Bonus when total is between thresholds" },
  { value: "yards_per_every", label: "Points for every X yards" },
  { value: "yards_per_every_after", label: "Points for every X yards after yard" },
  { value: "yards_per_every_up_to", label: "Points for every X yards up to yard" },
  { value: "yards_per_every_between", label: "Points for every X yards between yards" },
  { value: "td_min_yards", label: "Bonus for TDs of minimum yards" },
  { value: "td_max_yards", label: "Bonus for TDs of maximum yards" },
  { value: "td_range", label: "Bonus for TDs between yard range" },
  { value: "simple", label: "Points for every stat" },
  { value: "per_unit", label: "Points per unit of stat" },
  { value: "exact", label: "Bonus when stat is exact value" },
];

export const SCORING_CATEGORY_LABELS: Record<ScoringCategory, string> = {
  passing: "Passing",
  rushing: "Rushing",
  receiving: "Receiving",
  kicking: "Kicking",
  returning: "Returning",
  defense: "Defense",
  misc: "Misc",
};

export const SCORING_PRESET_OPTIONS: {
  value: ScoringPreset;
  label: string;
  description: string;
}[] = [
  {
    value: "standard",
    label: "Standard",
    description: "No points per reception.",
  },
  {
    value: "half_ppr",
    label: "Half PPR",
    description: "0.5 points per reception.",
  },
  {
    value: "full_ppr",
    label: "Full PPR",
    description: "1 point per reception.",
  },
];
