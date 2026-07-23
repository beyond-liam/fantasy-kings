import { z } from "zod";

import {
  SCORING_CATEGORY_LABELS,
  SCORING_POSITIONS,
  SCORING_RULE_KIND_OPTIONS,
  type ScoringCategory,
  type ScoringPosition,
  type ScoringRuleKind,
} from "@/lib/leagues/scoring/types";

const SCORING_CATEGORIES = Object.keys(SCORING_CATEGORY_LABELS) as [
  ScoringCategory,
  ...ScoringCategory[],
];

const SCORING_POSITIONS_TUPLE = SCORING_POSITIONS as [
  ScoringPosition,
  ...ScoringPosition[],
];

const SCORING_RULE_KINDS = SCORING_RULE_KIND_OPTIONS.map(
  (option) => option.value,
) as [ScoringRuleKind, ...ScoringRuleKind[]];

const MAX_RULES = 200;
const MAX_POINTS = 1000;
const MAX_STAT_VALUE = 100_000;

function boundedNumber(max: number) {
  return z.number().finite().min(-max).max(max);
}

export const scoringRuleDefinitionSchema = z
  .object({
    id: z.string().min(1).max(200),
    category: z.enum(SCORING_CATEGORIES),
    kind: z.enum(SCORING_RULE_KINDS),
    points: boundedNumber(MAX_POINTS),
    stat: z.string().min(1).max(200),
    every: boundedNumber(MAX_STAT_VALUE).optional(),
    rate: boundedNumber(MAX_STAT_VALUE).optional(),
    threshold: boundedNumber(MAX_STAT_VALUE).optional(),
    maxThreshold: boundedNumber(MAX_STAT_VALUE).optional(),
    minYards: boundedNumber(MAX_STAT_VALUE).optional(),
    maxYards: boundedNumber(MAX_STAT_VALUE).optional(),
    exactValue: boundedNumber(MAX_STAT_VALUE).optional(),
    positions: z.array(z.enum(SCORING_POSITIONS_TUPLE)).min(1).max(
      SCORING_POSITIONS_TUPLE.length,
    ),
  })
  .strict();

export const scoringRulesPayloadSchema = z
  .array(scoringRuleDefinitionSchema)
  .max(MAX_RULES);
