import {
  getDefaultRuleForCategory,
  getFirstAvailableRuleForCategory,
  getTemplateForKind,
  getTemplatesForCategoryStat,
} from "@/lib/leagues/scoring/stats";
import type {
  ScoringCategory,
  ScoringPosition,
  ScoringPreset,
  ScoringRuleDefinition,
  ScoringRuleKind,
} from "@/lib/leagues/scoring/types";
import {
  OFFENSE_SCORING_POSITIONS,
} from "@/lib/leagues/scoring/types";

type RuleInput = {
  id: string;
  category: ScoringCategory;
  kind: ScoringRuleKind;
  points: number;
  stat: string;
  every?: number;
  rate?: number;
  threshold?: number;
  minYards?: number;
  maxYards?: number;
  exactValue?: number;
  positions?: ScoringPosition[];
};

function offense(input: RuleInput): ScoringRuleDefinition {
  return {
    ...input,
    positions: input.positions ?? [...OFFENSE_SCORING_POSITIONS],
  };
}

function defense(input: RuleInput): ScoringRuleDefinition {
  return {
    ...input,
    positions: input.positions ?? ["DEF"],
  };
}

const PASSING: ScoringRuleDefinition[] = [
  offense({
    id: "passing-completions-25",
    category: "passing",
    kind: "threshold",
    points: 2,
    stat: "Passing Completions",
    threshold: 25,
  }),
  offense({
    id: "passing-yards-per-20",
    category: "passing",
    kind: "per_unit",
    points: 1,
    stat: "Passing Yards",
    every: 20,
    rate: 0.05,
  }),
  offense({
    id: "passing-yards-300",
    category: "passing",
    kind: "threshold",
    points: 1,
    stat: "Passing Yards",
    threshold: 300,
  }),
  offense({
    id: "passing-td",
    category: "passing",
    kind: "simple",
    points: 4,
    stat: "Passing TD",
  }),
  offense({
    id: "passing-td-40-79",
    category: "passing",
    kind: "td_range",
    points: 2,
    stat: "Passing TD",
    minYards: 40,
    maxYards: 79,
  }),
  offense({
    id: "passing-td-80",
    category: "passing",
    kind: "td_min_yards",
    points: 4,
    stat: "Passing TD",
    minYards: 80,
  }),
  offense({
    id: "passing-2pt",
    category: "passing",
    kind: "simple",
    points: 2,
    stat: "2 Pt Conversion Passing",
  }),
  offense({
    id: "passing-int",
    category: "passing",
    kind: "simple",
    points: -2,
    stat: "Interception",
  }),
];

const RUSHING: ScoringRuleDefinition[] = [
  offense({
    id: "rushing-attempts-30",
    category: "rushing",
    kind: "threshold",
    points: 2,
    stat: "Rushing Attempts",
    threshold: 30,
  }),
  offense({
    id: "rushing-yards-per-10",
    category: "rushing",
    kind: "per_unit",
    points: 1,
    stat: "Rushing Yards",
    every: 10,
    rate: 0.1,
  }),
  offense({
    id: "rushing-yards-150",
    category: "rushing",
    kind: "threshold",
    points: 1,
    stat: "Rushing Yards",
    threshold: 150,
  }),
  offense({
    id: "rushing-2pt",
    category: "rushing",
    kind: "simple",
    points: 2,
    stat: "2 Pt Conversion Rushing",
  }),
  offense({
    id: "rushing-td",
    category: "rushing",
    kind: "simple",
    points: 6,
    stat: "Rushing TD",
  }),
  offense({
    id: "rushing-td-40-79",
    category: "rushing",
    kind: "td_range",
    points: 2,
    stat: "Rushing TD",
    minYards: 40,
    maxYards: 79,
  }),
  offense({
    id: "rushing-td-80",
    category: "rushing",
    kind: "td_min_yards",
    points: 4,
    stat: "Rushing TD",
    minYards: 80,
  }),
];

const RECEIVING_BASE: ScoringRuleDefinition[] = [
  offense({
    id: "receiving-catches-9",
    category: "receiving",
    kind: "threshold",
    points: 2,
    stat: "Catches",
    threshold: 9,
  }),
  offense({
    id: "receiving-yards-per-10",
    category: "receiving",
    kind: "per_unit",
    points: 1,
    stat: "Receiving Yards",
    every: 10,
    rate: 0.1,
  }),
  offense({
    id: "receiving-yards-150",
    category: "receiving",
    kind: "threshold",
    points: 1,
    stat: "Receiving Yards",
    threshold: 150,
  }),
  offense({
    id: "receiving-2pt",
    category: "receiving",
    kind: "simple",
    points: 2,
    stat: "2 Pt Conversion Receiving",
  }),
  offense({
    id: "receiving-td",
    category: "receiving",
    kind: "simple",
    points: 6,
    stat: "Receiving TD",
  }),
  offense({
    id: "receiving-td-40-79",
    category: "receiving",
    kind: "td_range",
    points: 2,
    stat: "Receiving TD",
    minYards: 40,
    maxYards: 79,
  }),
  offense({
    id: "receiving-td-80",
    category: "receiving",
    kind: "td_min_yards",
    points: 4,
    stat: "Receiving TD",
    minYards: 80,
  }),
];

const KICKING: ScoringRuleDefinition[] = [
  offense({
    id: "kicking-fg",
    category: "kicking",
    kind: "simple",
    points: 3,
    stat: "Field Goal Made",
  }),
  offense({
    id: "kicking-fg-40-49",
    category: "kicking",
    kind: "td_range",
    points: 1,
    stat: "Field Goal Made",
    minYards: 40,
    maxYards: 49,
  }),
  offense({
    id: "kicking-fg-50",
    category: "kicking",
    kind: "td_min_yards",
    points: 3,
    stat: "Field Goal Made",
    minYards: 50,
  }),
  offense({
    id: "kicking-xp",
    category: "kicking",
    kind: "simple",
    points: 1,
    stat: "XP",
  }),
];

const RETURNING: ScoringRuleDefinition[] = [
  offense({
    id: "returning-kr-td",
    category: "returning",
    kind: "simple",
    points: 6,
    stat: "Kick Return TD",
  }),
  offense({
    id: "returning-pr-td",
    category: "returning",
    kind: "simple",
    points: 6,
    stat: "Punt Return TD",
  }),
];

const DEFENSE: ScoringRuleDefinition[] = [
  offense({
    id: "defense-solo-tackle",
    category: "defense",
    kind: "simple",
    points: 1,
    stat: "Solo Tackle",
    positions: [],
  }),
  defense({
    id: "defense-int",
    category: "defense",
    kind: "simple",
    points: 2,
    stat: "Interception",
  }),
  defense({
    id: "defense-sack",
    category: "defense",
    kind: "simple",
    points: 2,
    stat: "Sack",
  }),
  defense({
    id: "defense-fumble-forced",
    category: "defense",
    kind: "simple",
    points: 2,
    stat: "Fumble Forced",
  }),
  defense({
    id: "defense-fumble-recovered",
    category: "defense",
    kind: "simple",
    points: 1,
    stat: "Fumble Recovered",
  }),
  defense({
    id: "defense-safety",
    category: "defense",
    kind: "simple",
    points: 4,
    stat: "Safety",
  }),
  defense({
    id: "defense-td",
    category: "defense",
    kind: "simple",
    points: 6,
    stat: "Defensive TD",
  }),
  defense({
    id: "defense-td-40-79",
    category: "defense",
    kind: "td_range",
    points: 2,
    stat: "Defensive TD",
    minYards: 40,
    maxYards: 79,
  }),
  defense({
    id: "defense-td-80",
    category: "defense",
    kind: "td_min_yards",
    points: 4,
    stat: "Defensive TD",
    minYards: 80,
  }),
  defense({
    id: "defense-conversion-return",
    category: "defense",
    kind: "simple",
    points: 2,
    stat: "Conversion Return",
  }),
  defense({
    id: "defense-shutout",
    category: "defense",
    kind: "exact",
    points: 10,
    stat: "Points Allowed",
    exactValue: 0,
  }),
];

const MISC: ScoringRuleDefinition[] = [
  offense({
    id: "misc-fumble",
    category: "misc",
    kind: "simple",
    points: -1,
    stat: "Fumble",
  }),
  offense({
    id: "misc-fumble-lost",
    category: "misc",
    kind: "simple",
    points: -1,
    stat: "Fumble Lost",
  }),
  offense({
    id: "misc-ofr-td",
    category: "misc",
    kind: "simple",
    points: 6,
    stat: "Offensive Fumble Recovery TD",
  }),
  offense({
    id: "misc-ofr-td-40-79",
    category: "misc",
    kind: "td_range",
    points: 2,
    stat: "Offensive Fumble Recovery TD",
    minYards: 40,
    maxYards: 79,
  }),
  offense({
    id: "misc-ofr-td-80",
    category: "misc",
    kind: "td_min_yards",
    points: 4,
    stat: "Offensive Fumble Recovery TD",
    minYards: 80,
  }),
];

function getPprRule(preset: ScoringPreset): ScoringRuleDefinition | null {
  if (preset === "standard") {
    return null;
  }

  return offense({
    id: "receiving-ppr",
    category: "receiving",
    kind: "simple",
    points: preset === "half_ppr" ? 0.5 : 1,
    stat: "Reception",
  });
}

export function getDefaultScoringRuleDefinitions(
  preset: ScoringPreset,
): ScoringRuleDefinition[] {
  const pprRule = getPprRule(preset);
  const receiving = pprRule
    ? [pprRule, ...RECEIVING_BASE]
    : RECEIVING_BASE;

  return [
    ...PASSING,
    ...RUSHING,
    ...receiving,
    ...KICKING,
    ...RETURNING,
    ...DEFENSE,
    ...MISC,
  ];
}

export function createEmptyScoringRuleDefinition(
  category: ScoringCategory,
  existingRules: ScoringRuleDefinition[] = [],
): ScoringRuleDefinition {
  const catalogDefault =
    getFirstAvailableRuleForCategory(category, existingRules) ??
    getDefaultRuleForCategory(category);

  if (catalogDefault) {
    const templates = getTemplatesForCategoryStat(
      category,
      catalogDefault.stat,
    );
    const template = getTemplateForKind(templates, catalogDefault.kind);
    return {
      id: crypto.randomUUID(),
      category,
      kind: catalogDefault.kind,
      points: 1,
      stat: catalogDefault.stat,
      every: template?.fields.includes("every") ? 1 : undefined,
      threshold: template?.fields.includes("threshold") ? 0 : undefined,
      maxThreshold: template?.fields.includes("maxThreshold") ? 0 : undefined,
      minYards: template?.fields.includes("minYards") ? 0 : undefined,
      maxYards: template?.fields.includes("maxYards") ? 0 : undefined,
      positions:
        category === "defense"
          ? ["DEF"]
          : [...OFFENSE_SCORING_POSITIONS],
    };
  }

  return {
    id: crypto.randomUUID(),
    category,
    kind: "threshold",
    points: 1,
    stat: "",
    threshold: 0,
    positions:
      category === "defense" ? ["DEF"] : [...OFFENSE_SCORING_POSITIONS],
  };
}
