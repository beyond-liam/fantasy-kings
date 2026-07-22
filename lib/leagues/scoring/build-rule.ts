import {
  SCORING_POSITIONS,
  type ScoringRule,
  type ScoringRuleDefinition,
  type ScoringRuleSegment,
} from "@/lib/leagues/scoring/types";

function points(value: number): ScoringRuleSegment {
  return { type: "points", value };
}

function text(value: string, muted = false): ScoringRuleSegment {
  return { type: "text", value, muted };
}

function stat(value: string): ScoringRuleSegment {
  return { type: "stat", value };
}

function buildSegments(definition: ScoringRuleDefinition): ScoringRuleSegment[] {
  const {
    kind,
    points: pts,
    stat: statName,
    every,
    rate,
    threshold,
    maxThreshold,
    minYards,
    maxYards,
    exactValue,
  } = definition;

  switch (kind) {
    case "per_every": {
      const unit = Math.abs(pts) === 1 ? " point" : " points";
      const everyLabel =
        every && every !== 1 ? `${every} ${statName}` : statName;
      return [points(pts), text(`${unit} for every `), stat(everyLabel)];
    }
    case "per_every_after":
      return [
        points(pts),
        text(" points for every "),
        stat(every && every !== 1 ? `${every} ${statName}` : statName),
        text(" after reaching "),
        text(String(threshold ?? 0), true),
        text(" total "),
        stat(statName),
      ];
    case "per_every_first":
      return [
        points(pts),
        text(" points for every "),
        stat(every && every !== 1 ? `${every} ${statName}` : statName),
        text(" for the first "),
        text(String(maxThreshold ?? 0), true),
        text(" total "),
        stat(statName),
      ];
    case "per_every_between":
      return [
        points(pts),
        text(" points for every "),
        stat(every && every !== 1 ? `${every} ${statName}` : statName),
        text(" between "),
        text(String(threshold ?? 0), true),
        text(" and "),
        text(String(maxThreshold ?? 0), true),
        text(" total "),
        stat(statName),
        text(" (inclusive)"),
      ];
    case "threshold_lte":
      return [
        points(pts),
        text(" extra points when total "),
        stat(statName),
        text(" is less than or equal to "),
        text(String(maxThreshold ?? 0), true),
      ];
    case "threshold_between":
      return [
        points(pts),
        text(" extra points when total "),
        stat(statName),
        text(" is between "),
        text(String(threshold ?? 0), true),
        text(" and "),
        text(String(maxThreshold ?? 0), true),
        text(" (inclusive)"),
      ];
    case "yards_per_every":
      return [
        points(pts),
        text(" points for every "),
        text(String(every ?? 1), true),
        text(" yards covered by a "),
        stat(statName),
      ];
    case "yards_per_every_after":
      return [
        points(pts),
        text(" points for every "),
        text(String(every ?? 1), true),
        text(" yards covered by a "),
        stat(statName),
        text(" after yard "),
        text(String(minYards ?? 0), true),
      ];
    case "yards_per_every_up_to":
      return [
        points(pts),
        text(" points for every "),
        text(String(every ?? 1), true),
        text(" yards covered by a "),
        stat(statName),
        text(" up to yard "),
        text(String(maxYards ?? 0), true),
      ];
    case "yards_per_every_between":
      return [
        points(pts),
        text(" points for every "),
        text(String(every ?? 1), true),
        text(" yards covered by a "),
        stat(statName),
        text(" between yards "),
        text(String(minYards ?? 0), true),
        text(" and "),
        text(String(maxYards ?? 0), true),
        text(" (inclusive)"),
      ];
    case "td_max_yards":
      return [
        points(pts),
        text(" extra points for every "),
        stat(statName),
        text(" of "),
        text(String(maxYards ?? 0), true),
        text(" or less yards"),
      ];
    case "simple": {
      const unit = Math.abs(pts) === 1 ? " point" : " points";
      return [points(pts), text(`${unit} for every `), stat(statName)];
    }
    case "per_unit":
      return [
        points(pts),
        text(" point for every "),
        stat(every === 1 ? statName : `${every ?? 1} ${statName}`),
        text(` (${rate ?? 0} per)`, true),
      ];
    case "threshold":
      return [
        points(pts),
        text(" extra points when total "),
        stat(statName),
        text(" is greater than or equal to "),
        text(String(threshold ?? 0), true),
      ];
    case "td_range":
      return [
        points(pts),
        text(" extra points for every "),
        stat(statName),
        text(" between "),
        text(String(minYards ?? 0), true),
        text(" and "),
        text(String(maxYards ?? 0), true),
        text(" yards (inclusive)"),
      ];
    case "td_min_yards":
      return [
        points(pts),
        text(" extra points for every "),
        stat(statName),
        text(" of "),
        text(String(minYards ?? 0), true),
        text(" or more yards"),
      ];
    case "exact":
      return [
        points(pts),
        text(" extra points when total "),
        stat(statName),
        text(" is exactly "),
        text(String(exactValue ?? 0), true),
      ];
    default:
      return [points(pts), text(" points for "), stat(statName)];
  }
}

export function buildScoringRule(
  definition: ScoringRuleDefinition,
): ScoringRule {
  return {
    ...definition,
    segments: buildSegments(definition),
  };
}

export function buildScoringRules(
  definitions: ScoringRuleDefinition[],
): ScoringRule[] {
  return definitions.map(buildScoringRule);
}

export function formatScoringPositions(
  positions: ScoringRuleDefinition["positions"],
): string {
  if (positions.length === 0) {
    return "None";
  }

  const hasEveryPosition = SCORING_POSITIONS.every((position) =>
    positions.includes(position),
  );

  if (hasEveryPosition && positions.length === SCORING_POSITIONS.length) {
    return "ALL";
  }

  const sorted = [...positions].sort(
    (a, b) => SCORING_POSITIONS.indexOf(a) - SCORING_POSITIONS.indexOf(b),
  );

  return sorted.join(", ");
}
