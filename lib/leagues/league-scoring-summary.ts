import type { ScoringPreset, ScoringRuleDefinition } from "@/lib/leagues/scoring";
import {
  getScoringRulesByCategory,
  resolveScoringRuleDefinitions,
  SCORING_CATEGORY_LABELS,
  SCORING_PRESET_OPTIONS,
  type ScoringRule,
} from "@/lib/leagues/scoring";

export type LeagueScoringSection = {
  title: string;
  rules: ScoringRule[];
};

export type LeagueScoringSummaryModel = {
  presetLabel: string;
  presetDescription: string;
  sections: LeagueScoringSection[];
};

export function buildLeagueScoringSummary(input: {
  scoringPreset: ScoringPreset;
  scoringRules?: ScoringRuleDefinition[] | null;
}): LeagueScoringSummaryModel {
  const definitions = resolveScoringRuleDefinitions(
    input.scoringPreset,
    input.scoringRules,
  );
  const preset =
    SCORING_PRESET_OPTIONS.find(
      (option) => option.value === input.scoringPreset,
    ) ?? SCORING_PRESET_OPTIONS[0];

  return {
    presetLabel: preset.label,
    presetDescription: preset.description,
    sections: getScoringRulesByCategory(definitions)
      .filter((section) => section.rules.length > 0)
      .map((section) => ({
        title: SCORING_CATEGORY_LABELS[section.category],
        rules: section.rules,
      })),
  };
}
