import { buildScoringRules } from "@/lib/leagues/scoring/build-rule";
import {
  filterScoringRulesForPositions,
  getDefaultScoringRuleDefinitions,
  isTeamDefenseRule,
} from "@/lib/leagues/scoring/defaults";
import type {
  ScoringCategory,
  ScoringPosition,
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

/** Drop team-DEF defaults that were remapped off `DEF`. */
function sanitizeScoringRuleDefinitions(
  rules: ScoringRuleDefinition[],
): ScoringRuleDefinition[] {
  return rules.filter(
    (rule) => !isTeamDefenseRule(rule) || rule.positions.includes("DEF"),
  );
}

export function resolveScoringRuleDefinitions(
  preset: ScoringPreset,
  customRules?: ScoringRuleDefinition[] | null,
  availablePositions?: ScoringPosition[],
): ScoringRuleDefinition[] {
  const rules = sanitizeScoringRuleDefinitions(
    customRules && customRules.length > 0
      ? customRules
      : getDefaultScoringRuleDefinitions(preset),
  );

  return availablePositions
    ? filterScoringRulesForPositions(rules, availablePositions)
    : rules;
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
