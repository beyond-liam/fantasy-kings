import type { ScoringStatDefinition } from "@/lib/leagues/scoring/stats/types";

export const RETURNING_STATS: ScoringStatDefinition[] = [
  {
    id: "kick-return-attempts",
    label: "Kick Return Attempts",
    category: "returning",
    templateSet: "quantity",
  },
  {
    id: "kick-return-yards",
    label: "Kick Return Yards",
    category: "returning",
    templateSet: "quantity",
  },
  {
    id: "kick-return-tds-quantity",
    label: "Kick Return TDs (Quantity)",
    category: "returning",
    templateSet: "quantity",
  },
  {
    id: "kick-return-tds-distance",
    label: "Kick Return TDs (Distance)",
    category: "returning",
    templateSet: "distance",
  },
  {
    id: "punt-return-attempts",
    label: "Punt Return Attempts",
    category: "returning",
    templateSet: "quantity",
  },
  {
    id: "punt-return-yards",
    label: "Punt Return Yards",
    category: "returning",
    templateSet: "quantity",
  },
  {
    id: "punt-return-tds-quantity",
    label: "Punt Return TDs (Quantity)",
    category: "returning",
    templateSet: "quantity",
  },
  {
    id: "punt-return-tds-distance",
    label: "Punt Return TDs (Distance)",
    category: "returning",
    templateSet: "distance",
  },
];
