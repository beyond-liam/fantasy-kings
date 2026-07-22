import type { ScoringRuleTemplate } from "@/lib/leagues/scoring/stats/types";

export const QUANTITY_RULE_TEMPLATES: ScoringRuleTemplate[] = [
  {
    id: "every",
    label: "P points for every X {{stat}}",
    kind: "per_every",
    fields: ["points", "every"],
  },
  {
    id: "every-after",
    label: "P points for every X {{stat}} after reaching L total {{stat}}",
    kind: "per_every_after",
    fields: ["points", "every", "threshold"],
  },
  {
    id: "every-first",
    label: "P points for every X {{stat}} for the first H total {{stat}}",
    kind: "per_every_first",
    fields: ["points", "every", "maxThreshold"],
  },
  {
    id: "every-between",
    label:
      "P points for every X {{stat}} between L and H total {{stat}} (inclusive)",
    kind: "per_every_between",
    fields: ["points", "every", "threshold", "maxThreshold"],
  },
  {
    id: "bonus-gte",
    label: "P extra points when total {{stat}} is greater than or equal to L",
    kind: "threshold",
    fields: ["points", "threshold"],
  },
  {
    id: "bonus-lte",
    label: "P extra points when total {{stat}} is less than or equal to H",
    kind: "threshold_lte",
    fields: ["points", "maxThreshold"],
  },
  {
    id: "bonus-between",
    label: "P extra points when total {{stat}} is between L and H (inclusive)",
    kind: "threshold_between",
    fields: ["points", "threshold", "maxThreshold"],
  },
];

export const DISTANCE_RULE_TEMPLATES: ScoringRuleTemplate[] = [
  {
    id: "yards-every",
    label: "P points for every X yards covered by a {{stat}}",
    kind: "yards_per_every",
    fields: ["points", "every"],
  },
  {
    id: "yards-every-after",
    label: "P points for every X yards covered by a {{stat}} after yard L",
    kind: "yards_per_every_after",
    fields: ["points", "every", "minYards"],
  },
  {
    id: "yards-every-up-to",
    label: "P points for every X yards covered by a {{stat}} up to yard H",
    kind: "yards_per_every_up_to",
    fields: ["points", "every", "maxYards"],
  },
  {
    id: "yards-every-between",
    label:
      "P points for every X yards covered by a {{stat}} between yards L and H (inclusive)",
    kind: "yards_per_every_between",
    fields: ["points", "every", "minYards", "maxYards"],
  },
  {
    id: "bonus-td-gte",
    label: "P extra points for every {{stat}} of L or more yards",
    kind: "td_min_yards",
    fields: ["points", "minYards"],
  },
  {
    id: "bonus-td-lte",
    label: "P extra points for every {{stat}} of H or less yards",
    kind: "td_max_yards",
    fields: ["points", "maxYards"],
  },
  {
    id: "bonus-td-between",
    label: "P extra points for every {{stat}} between L and H yards (inclusive)",
    kind: "td_range",
    fields: ["points", "minYards", "maxYards"],
  },
];
