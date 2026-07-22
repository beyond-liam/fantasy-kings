import type { ScoringStatDefinition } from "@/lib/leagues/scoring/stats/types";

export const RECEIVING_STATS: ScoringStatDefinition[] = [
  {
    id: "catches",
    label: "Catches",
    category: "receiving",
    templateSet: "quantity",
  },
  {
    id: "catches-20",
    label: "Catches of 20+ Yards",
    category: "receiving",
    templateSet: "quantity",
  },
  {
    id: "catches-40",
    label: "Catches of 40+ Yards",
    category: "receiving",
    templateSet: "quantity",
  },
  {
    id: "catches-60",
    label: "Catches of 60+ Yards",
    category: "receiving",
    templateSet: "quantity",
  },
  {
    id: "targets",
    label: "Targets",
    category: "receiving",
    templateSet: "quantity",
  },
  {
    id: "target-percent-caught",
    label: "Target % Caught",
    category: "receiving",
    templateSet: "quantity",
  },
  {
    id: "drops",
    label: "Drops",
    category: "receiving",
    templateSet: "quantity",
  },
  {
    id: "receiving-yards",
    label: "Receiving Yards",
    category: "receiving",
    templateSet: "quantity",
  },
  {
    id: "yards-after-catch",
    label: "Yards After Catch",
    category: "receiving",
    templateSet: "quantity",
  },
  {
    id: "yards-per-reception",
    label: "Yard Per Reception",
    category: "receiving",
    templateSet: "quantity",
  },
  {
    id: "two-pt-conversions-receiving",
    label: "2 Pt Conversions Receiving",
    category: "receiving",
    templateSet: "quantity",
  },
  {
    id: "receiving-tds-quantity",
    label: "Receiving TDs (Quantity)",
    category: "receiving",
    templateSet: "quantity",
  },
  {
    id: "receiving-tds-distance",
    label: "Receiving TDs (Distance)",
    category: "receiving",
    templateSet: "distance",
  },
  {
    id: "receiving-first-downs",
    label: "Receiving First Downs",
    category: "receiving",
    templateSet: "quantity",
  },
];
