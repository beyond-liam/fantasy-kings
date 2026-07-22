import type { ScoringStatDefinition } from "@/lib/leagues/scoring/stats/types";

export const PASSING_STATS: ScoringStatDefinition[] = [
  {
    id: "passing-completions",
    label: "Passing Completions",
    category: "passing",
    templateSet: "quantity",
  },
  {
    id: "passing-completions-20",
    label: "Passing Completions of 20+ Yards",
    category: "passing",
    templateSet: "quantity",
  },
  {
    id: "passing-completions-40",
    label: "Passing Completions of 40+ Yards",
    category: "passing",
    templateSet: "quantity",
  },
  {
    id: "passing-completions-60",
    label: "Passing Completions of 60+ Yards",
    category: "passing",
    templateSet: "quantity",
  },
  {
    id: "passing-attempts",
    label: "Passing Attempts",
    category: "passing",
    templateSet: "quantity",
  },
  {
    id: "incomplete-passes",
    label: "Incomplete Passes",
    category: "passing",
    templateSet: "quantity",
  },
  {
    id: "dropped-passes",
    label: "Dropped Passes",
    category: "passing",
    templateSet: "quantity",
  },
  {
    id: "completion-percentage",
    label: "Completion Percentage",
    category: "passing",
    templateSet: "quantity",
  },
  {
    id: "passing-yards",
    label: "Passing Yards",
    category: "passing",
    templateSet: "quantity",
  },
  {
    id: "yards-per-attempt",
    label: "Yard Per Attempt",
    category: "passing",
    templateSet: "quantity",
  },
  {
    id: "passing-tds-quantity",
    label: "Passing TDs (Quantity)",
    category: "passing",
    templateSet: "quantity",
  },
  {
    id: "passing-tds-distance",
    label: "Passing TDs (Distance)",
    category: "passing",
    templateSet: "distance",
  },
  {
    id: "two-pt-conversions-passing",
    label: "2 Pt Conversions Passing",
    category: "passing",
    templateSet: "quantity",
  },
  {
    id: "interceptions",
    label: "Interceptions",
    category: "passing",
    templateSet: "quantity",
  },
  {
    id: "interceptions-for-td",
    label: "Interceptions For TD",
    category: "passing",
    templateSet: "quantity",
  },
  {
    id: "times-sacked",
    label: "Times Sacked",
    category: "passing",
    templateSet: "quantity",
  },
  {
    id: "sacked-yards",
    label: "Sacked Yards",
    category: "passing",
    templateSet: "quantity",
  },
  {
    id: "qb-rating",
    label: "QB Rating",
    category: "passing",
    templateSet: "quantity",
  },
  {
    id: "passing-first-downs",
    label: "Passing First Downs",
    category: "passing",
    templateSet: "quantity",
  },
];
