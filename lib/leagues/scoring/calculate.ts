import { buildScoringRule } from "@/lib/leagues/scoring/build-rule";
import {
  resolveDistanceStatKey,
  resolveSleeperStatKey,
} from "@/lib/leagues/scoring/stat-keys";
import type {
  ScoringPosition,
  ScoringRuleDefinition,
} from "@/lib/leagues/scoring/types";

export type PlayerStatBag = Record<string, number | null | undefined>;

function getNumericStat(stats: PlayerStatBag, key: string | null): number {
  if (!key) {
    return 0;
  }

  const value = stats[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return value;
}

function ruleAppliesToPosition(
  rule: ScoringRuleDefinition,
  position: string,
): boolean {
  if (rule.positions.length === 0) {
    return false;
  }

  return rule.positions.includes(position as ScoringPosition);
}

function evaluateRule(
  rule: ScoringRuleDefinition,
  stats: PlayerStatBag,
): number {
  const aggregateKey = resolveSleeperStatKey(rule);
  const distanceKey = resolveDistanceStatKey(rule);
  const statValue = getNumericStat(stats, distanceKey ?? aggregateKey);

  switch (rule.kind) {
    case "simple":
      return rule.points * statValue;
    case "per_unit": {
      const every = rule.every ?? 1;
      if (rule.rate != null) {
        return statValue * rule.rate;
      }

      return (statValue / every) * rule.points;
    }
    case "threshold": {
      const total = getNumericStat(stats, aggregateKey);
      return total >= (rule.threshold ?? 0) ? rule.points : 0;
    }
    case "threshold_lte": {
      const total = getNumericStat(stats, aggregateKey);
      return total <= (rule.maxThreshold ?? 0) ? rule.points : 0;
    }
    case "threshold_between": {
      const total = getNumericStat(stats, aggregateKey);
      const min = rule.threshold ?? 0;
      const max = rule.maxThreshold ?? 0;
      return total >= min && total <= max ? rule.points : 0;
    }
    case "exact": {
      if (distanceKey) {
        return statValue > 0 ? rule.points : 0;
      }

      const total = getNumericStat(stats, aggregateKey);
      return total === (rule.exactValue ?? 0) ? rule.points : 0;
    }
    case "td_range":
    case "td_min_yards":
      return distanceKey ? rule.points * statValue : 0;
    case "per_every":
      return (
        Math.floor(statValue / (rule.every ?? 1)) * rule.points
      );
    case "per_every_after": {
      const total = getNumericStat(stats, aggregateKey);
      const threshold = rule.threshold ?? 0;
      const every = rule.every ?? 1;
      if (total <= threshold) {
        return 0;
      }

      return Math.floor((total - threshold) / every) * rule.points;
    }
    case "per_every_first": {
      const total = getNumericStat(stats, aggregateKey);
      const cap = rule.maxThreshold ?? 0;
      const every = rule.every ?? 1;
      const eligible = Math.min(total, cap);
      return Math.floor(eligible / every) * rule.points;
    }
    case "per_every_between": {
      const total = getNumericStat(stats, aggregateKey);
      const min = rule.threshold ?? 0;
      const max = rule.maxThreshold ?? 0;
      const every = rule.every ?? 1;
      if (total < min) {
        return 0;
      }

      const eligible = Math.min(total, max) - min + 1;
      return Math.max(0, Math.floor(eligible / every)) * rule.points;
    }
    case "yards_per_every":
      return (
        Math.floor(statValue / (rule.every ?? 1)) * rule.points
      );
    case "yards_per_every_after": {
      const yards = statValue;
      const start = rule.minYards ?? 0;
      const every = rule.every ?? 1;
      if (yards <= start) {
        return 0;
      }

      return Math.floor((yards - start) / every) * rule.points;
    }
    case "yards_per_every_up_to": {
      const yards = statValue;
      const cap = rule.maxYards ?? 0;
      const every = rule.every ?? 1;
      return Math.floor(Math.min(yards, cap) / every) * rule.points;
    }
    case "yards_per_every_between": {
      const yards = statValue;
      const min = rule.minYards ?? 0;
      const max = rule.maxYards ?? 0;
      const every = rule.every ?? 1;
      if (yards < min) {
        return 0;
      }

      const eligible = Math.min(yards, max) - min;
      return Math.max(0, Math.floor(eligible / every)) * rule.points;
    }
    default:
      return 0;
  }
}

export function calculatePlayerPoints(
  stats: PlayerStatBag,
  position: string,
  rules: ScoringRuleDefinition[],
): number {
  let total = 0;

  for (const rule of rules) {
    if (!ruleAppliesToPosition(rule, position)) {
      continue;
    }

    total += evaluateRule(rule, stats);
  }

  return Math.round(total * 100) / 100;
}

export type PlayerPointsLine = {
  id: string;
  label: string;
  statValue: number;
  points: number;
};

export type PlayerPointsExplanation = {
  total: number;
  lines: PlayerPointsLine[];
};

function formatRuleLabel(rule: ScoringRuleDefinition): string {
  const segments = buildScoringRule(rule).segments;
  const fromSegments = segments
    .map((segment) => {
      if (segment.type === "points") return String(segment.value);
      return segment.value;
    })
    .join("")
    .trim();
  return fromSegments || rule.stat;
}

/**
 * Per-rule fantasy point contributions for a player's week stats.
 * Zero-contribution rules are omitted.
 */
export function explainPlayerPoints(
  stats: PlayerStatBag,
  position: string,
  rules: ScoringRuleDefinition[],
): PlayerPointsExplanation {
  const lines: PlayerPointsLine[] = [];
  let total = 0;

  for (const rule of rules) {
    if (!ruleAppliesToPosition(rule, position)) {
      continue;
    }

    const points = evaluateRule(rule, stats);
    if (Math.abs(points) < 0.005) {
      continue;
    }

    const aggregateKey = resolveSleeperStatKey(rule);
    const distanceKey = resolveDistanceStatKey(rule);
    const statValue = getNumericStat(stats, distanceKey ?? aggregateKey);
    const rounded = Math.round(points * 100) / 100;
    total += rounded;
    lines.push({
      id: rule.id,
      label: formatRuleLabel(rule),
      statValue,
      points: rounded,
    });
  }

  return {
    total: Math.round(total * 100) / 100,
    lines,
  };
}
