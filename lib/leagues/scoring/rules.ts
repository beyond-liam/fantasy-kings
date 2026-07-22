import { buildScoringRules } from "@/lib/leagues/scoring/build-rule";
import { getDefaultScoringRuleDefinitions } from "@/lib/leagues/scoring/defaults";
import type {
  ScoringCategory,
  ScoringPreset,
  ScoringRule,
  ScoringRuleDefinition,
} from "@/lib/leagues/scoring/types";

const SCORING_CATEGORIES = [
  "passing",
  "rushing",
  "receiving",
  "kicking",
  "returning",
  "defense",
  "misc",
] as const;

export function resolveScoringRuleDefinitions(
  preset: ScoringPreset,
  customRules?: ScoringRuleDefinition[] | null,
): ScoringRuleDefinition[] {
  if (customRules && customRules.length > 0) {
    return customRules;
  }

  return getDefaultScoringRuleDefinitions(preset);
}

export function getScoringRulesForPreset(preset: ScoringPreset): ScoringRule[] {
  return buildScoringRules(getDefaultScoringRuleDefinitions(preset));
}

export function getScoringRulesByCategory(
  definitions: ScoringRuleDefinition[],
): { category: ScoringCategory; rules: ScoringRule[] }[] {
  const rules = buildScoringRules(definitions);

  return SCORING_CATEGORIES.map((category) => ({
    category,
    rules: rules.filter((rule) => rule.category === category),
  }));
}
