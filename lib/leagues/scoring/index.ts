export type { ScoringPreset } from "@/lib/leagues/scoring/types";
export {
  SCORING_CATEGORY_LABELS,
  SCORING_POSITIONS,
  SCORING_PRESET_OPTIONS,
  SCORING_RULE_KIND_OPTIONS,
  OFFENSE_SCORING_POSITIONS,
} from "@/lib/leagues/scoring/types";
export type {
  ScoringCategory,
  ScoringPosition,
  ScoringRule,
  ScoringRuleDefinition,
  ScoringRuleKind,
} from "@/lib/leagues/scoring/types";
export {
  buildScoringRule,
  buildScoringRules,
  formatScoringPositions,
} from "@/lib/leagues/scoring/build-rule";
export {
  createEmptyScoringRuleDefinition,
  getDefaultScoringRuleDefinitions,
} from "@/lib/leagues/scoring/defaults";
export {
  getDefaultRuleForCategory,
  getFirstAvailableRuleForCategory,
  getStatDefinition,
  getStatsForCategory,
  getTemplateForKind,
  getTemplatesForCategoryStat,
  getTemplatesForStat,
  getCatalogComboKey,
  getUsedCatalogCombos,
  categoryHasAvailableRule,
  hasStatCatalog,
  formatTemplateLabel,
  normalizeRuleToCatalogCombo,
  normalizeRuleToCatalogStat,
  DEFENSE_STATS,
  KICKING_STATS,
  MISC_STATS,
  PASSING_STATS,
  RECEIVING_STATS,
  RETURNING_STATS,
  RUSHING_STATS,
  DISTANCE_RULE_TEMPLATES,
  QUANTITY_RULE_TEMPLATES,
} from "@/lib/leagues/scoring/stats";
export {
  getScoringRulesByCategory,
  getScoringRulesForPreset,
  resolveScoringRuleDefinitions,
} from "@/lib/leagues/scoring/rules";
export {
  calculatePlayerPoints,
  explainPlayerPoints,
} from "@/lib/leagues/scoring/calculate";
export type {
  PlayerPointsExplanation,
  PlayerPointsLine,
} from "@/lib/leagues/scoring/calculate";
export {
  normalizePlayerStats,
} from "@/lib/leagues/scoring/normalize-stats";
export type {
  ScoringRuleField,
  ScoringRuleTemplate,
  ScoringStatDefinition,
  ScoringStatTemplateSet,
} from "@/lib/leagues/scoring/stats";
