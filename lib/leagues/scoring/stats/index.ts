import { DEFENSE_STATS } from "@/lib/leagues/scoring/stats/defense";
import { KICKING_STATS } from "@/lib/leagues/scoring/stats/kicking";
import { MISC_STATS } from "@/lib/leagues/scoring/stats/misc";
import { PASSING_STATS } from "@/lib/leagues/scoring/stats/passing";
import { RECEIVING_STATS } from "@/lib/leagues/scoring/stats/receiving";
import { RETURNING_STATS } from "@/lib/leagues/scoring/stats/returning";
import { RUSHING_STATS } from "@/lib/leagues/scoring/stats/rushing";
import {
  DISTANCE_RULE_TEMPLATES,
  QUANTITY_RULE_TEMPLATES,
} from "@/lib/leagues/scoring/stats/templates";
import {
  getCatalogComboKey,
  getUsedCatalogCombos,
  normalizeRuleToCatalogCombo,
  normalizeRuleToCatalogStat,
} from "@/lib/leagues/scoring/stats/normalize";
import type {
  ScoringRuleTemplate,
  ScoringStatDefinition,
  ScoringStatTemplateSet,
} from "@/lib/leagues/scoring/stats/types";
import type {
  ScoringCategory,
  ScoringRuleDefinition,
  ScoringRuleKind,
} from "@/lib/leagues/scoring/types";

const STATS_BY_CATEGORY: Record<ScoringCategory, ScoringStatDefinition[]> = {
  passing: PASSING_STATS,
  rushing: RUSHING_STATS,
  receiving: RECEIVING_STATS,
  kicking: KICKING_STATS,
  returning: RETURNING_STATS,
  defense: DEFENSE_STATS,
  misc: MISC_STATS,
};

const TEMPLATES_BY_SET: Record<ScoringStatTemplateSet, ScoringRuleTemplate[]> = {
  quantity: QUANTITY_RULE_TEMPLATES,
  distance: DISTANCE_RULE_TEMPLATES,
};

export function hasStatCatalog(category: ScoringCategory): boolean {
  return Boolean(STATS_BY_CATEGORY[category]?.length);
}

export function getStatsForCategory(
  category: ScoringCategory,
): ScoringStatDefinition[] {
  return STATS_BY_CATEGORY[category] ?? [];
}

export function getStatDefinition(
  category: ScoringCategory,
  stat: string,
): ScoringStatDefinition | undefined {
  return getStatsForCategory(category).find((entry) => entry.label === stat);
}

export function getTemplatesForStat(
  stat: ScoringStatDefinition,
): ScoringRuleTemplate[] {
  return TEMPLATES_BY_SET[stat.templateSet];
}

export function getTemplatesForCategoryStat(
  category: ScoringCategory,
  stat: string,
): ScoringRuleTemplate[] {
  const definition = getStatDefinition(category, stat);
  return definition ? getTemplatesForStat(definition) : [];
}

export function getTemplateForKind(
  templates: ScoringRuleTemplate[],
  kind: ScoringRuleKind,
): ScoringRuleTemplate | undefined {
  return templates.find((template) => template.kind === kind);
}

export function formatTemplateLabel(
  template: ScoringRuleTemplate,
  stat: string,
): string {
  return template.label.replaceAll("{{stat}}", stat);
}

export function categoryHasAvailableRule(
  category: ScoringCategory,
  rules: Pick<ScoringRuleDefinition, "id" | "category" | "stat" | "kind">[],
): boolean {
  const used = getUsedCatalogCombos(rules, { category });
  return getStatsForCategory(category).some((stat) =>
    getTemplatesForStat(stat).some(
      (template) =>
        !used.has(
          getCatalogComboKey({ stat: stat.label, kind: template.kind }),
        ),
    ),
  );
}

export function getDefaultRuleForCategory(
  category: ScoringCategory,
): {
  stat: string;
  kind: ScoringRuleKind;
} | null {
  const stats = getStatsForCategory(category);
  if (stats.length === 0) {
    return null;
  }

  const stat = stats[0];
  const template = getTemplatesForStat(stat)[0];
  return { stat: stat.label, kind: template.kind };
}

export function getFirstAvailableRuleForCategory(
  category: ScoringCategory,
  rules: Pick<ScoringRuleDefinition, "id" | "category" | "stat" | "kind">[],
): {
  stat: string;
  kind: ScoringRuleKind;
} | null {
  const used = getUsedCatalogCombos(rules, { category });

  for (const stat of getStatsForCategory(category)) {
    for (const template of getTemplatesForStat(stat)) {
      if (
        !used.has(
          getCatalogComboKey({ stat: stat.label, kind: template.kind }),
        )
      ) {
        return { stat: stat.label, kind: template.kind };
      }
    }
  }

  return null;
}

export {
  getCatalogComboKey,
  getUsedCatalogCombos,
  normalizeRuleToCatalogCombo,
  normalizeRuleToCatalogStat,
};
export {
  DEFENSE_STATS,
  KICKING_STATS,
  MISC_STATS,
  PASSING_STATS,
  RECEIVING_STATS,
  RETURNING_STATS,
  RUSHING_STATS,
  DISTANCE_RULE_TEMPLATES,
  QUANTITY_RULE_TEMPLATES,
};
export type {
  ScoringRuleField,
  ScoringRuleTemplate,
  ScoringStatDefinition,
  ScoringStatTemplateSet,
} from "@/lib/leagues/scoring/stats/types";
