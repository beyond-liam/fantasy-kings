import type { ScoringCategory, ScoringRuleKind } from "@/lib/leagues/scoring/types";

export type ScoringStatTemplateSet = "quantity" | "distance";

export type ScoringRuleField =
  | "points"
  | "every"
  | "threshold"
  | "maxThreshold"
  | "minYards"
  | "maxYards";

export type ScoringStatDefinition = {
  id: string;
  label: string;
  category: ScoringCategory;
  templateSet: ScoringStatTemplateSet;
  /**
   * When true, the same catalog stat+kind can be added multiple times
   * (e.g. Points Allowed tiers with different thresholds).
   */
  allowMultiple?: boolean;
};

export type ScoringRuleTemplate = {
  id: string;
  label: string;
  kind: ScoringRuleKind;
  fields: ScoringRuleField[];
};
