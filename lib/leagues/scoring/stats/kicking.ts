import type { ScoringStatDefinition } from "@/lib/leagues/scoring/stats/types";

export const KICKING_STATS: ScoringStatDefinition[] = [
  {
    id: "field-goals-made-quantity",
    label: "Field Goals Made (Quantity)",
    category: "kicking",
    templateSet: "quantity",
  },
  {
    id: "field-goals-made-distance",
    label: "Field Goals Made (Distance)",
    category: "kicking",
    templateSet: "distance",
  },
  {
    id: "field-goal-missed-quantity",
    label: "Field Goal Missed (Quantity)",
    category: "kicking",
    templateSet: "quantity",
  },
  {
    id: "field-goals-missed-distance",
    label: "Field Goals Missed (Distance)",
    category: "kicking",
    templateSet: "distance",
  },
  {
    id: "field-goal-attempts",
    label: "Field Goal Attempts",
    category: "kicking",
    templateSet: "quantity",
  },
  {
    id: "fg-percentage",
    label: "FG Percentage",
    category: "kicking",
    templateSet: "quantity",
  },
  {
    id: "xps",
    label: "XPs",
    category: "kicking",
    templateSet: "quantity",
  },
  {
    id: "xps-missed",
    label: "XPs Missed",
    category: "kicking",
    templateSet: "quantity",
  },
  {
    id: "extra-point-attempts",
    label: "Extra Point Attempts",
    category: "kicking",
    templateSet: "quantity",
  },
  {
    id: "xp-percentage",
    label: "XP Percentage",
    category: "kicking",
    templateSet: "quantity",
  },
];
