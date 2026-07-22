import type { ScoringStatDefinition } from "@/lib/leagues/scoring/stats/types";

export const RUSHING_STATS: ScoringStatDefinition[] = [
  {
    id: "rushing-attempts",
    label: "Rushing Attempts",
    category: "rushing",
    templateSet: "quantity",
  },
  {
    id: "rushing-attempts-20",
    label: "Rushing Attempts of 20+ Yards",
    category: "rushing",
    templateSet: "quantity",
  },
  {
    id: "rushing-attempts-40",
    label: "Rushing Attempts of 40+ Yards",
    category: "rushing",
    templateSet: "quantity",
  },
  {
    id: "rushing-attempts-60",
    label: "Rushing Attempts of 60+ Yards",
    category: "rushing",
    templateSet: "quantity",
  },
  {
    id: "rushing-yards",
    label: "Rushing Yards",
    category: "rushing",
    templateSet: "quantity",
  },
  {
    id: "yards-per-attempt",
    label: "Yard Per Attempt",
    category: "rushing",
    templateSet: "quantity",
  },
  {
    id: "two-pt-conversions-rushing",
    label: "2 Pt Conversions Rushing",
    category: "rushing",
    templateSet: "quantity",
  },
  {
    id: "rushing-tds-quantity",
    label: "Rushing TDs (Quantity)",
    category: "rushing",
    templateSet: "quantity",
  },
  {
    id: "rushing-tds-distance",
    label: "Rushing TDs (Distance)",
    category: "rushing",
    templateSet: "distance",
  },
  {
    id: "rushing-first-downs",
    label: "Rushing First Downs",
    category: "rushing",
    templateSet: "quantity",
  },
];
