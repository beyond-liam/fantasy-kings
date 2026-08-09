import type { LeagueActivityMetadata } from "@/db/schema/league-activity";
import { logLeagueActivity } from "@/lib/leagues/activity-log";
import {
  formatScoringPositions,
  formatScoringRuleText,
} from "@/lib/leagues/scoring/build-rule";
import { SCORING_CATEGORY_LABELS } from "@/lib/leagues/scoring/types";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import { formatSettingsActivityLabel } from "@/lib/leagues/settings-activity-labels";

export { formatSettingsActivityLabel } from "@/lib/leagues/settings-activity-labels";

export type SettingsChange = {
  path: string;
  label: string;
  before: string;
  after: string;
};

export type SettingsFieldDef = {
  path: string;
  label: string;
  format?: (value: unknown) => string;
};

function defaultFormat(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim() || "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value.map((item) => defaultFormat(item)).join(", ");
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function readPath(source: unknown, path: string): unknown {
  if (source == null || typeof source !== "object") return undefined;
  const parts = path.split(".");
  let current: unknown = source;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function diffSettingsValues(
  before: unknown,
  after: unknown,
  fields: SettingsFieldDef[],
): SettingsChange[] {
  const changes: SettingsChange[] = [];
  for (const field of fields) {
    const format = field.format ?? defaultFormat;
    const prev = format(readPath(before, field.path));
    const next = format(readPath(after, field.path));
    if (prev === next) continue;
    changes.push({
      path: field.path,
      label: field.label,
      before: prev,
      after: next,
    });
  }
  return changes;
}

function scoringRuleFingerprint(rule: ScoringRuleDefinition): string {
  return JSON.stringify({
    category: rule.category,
    kind: rule.kind,
    points: rule.points,
    stat: rule.stat,
    every: rule.every ?? null,
    rate: rule.rate ?? null,
    threshold: rule.threshold ?? null,
    maxThreshold: rule.maxThreshold ?? null,
    minYards: rule.minYards ?? null,
    maxYards: rule.maxYards ?? null,
    exactValue: rule.exactValue ?? null,
    positions: [...rule.positions].toSorted(),
  });
}

function scoringRuleLabel(rule: ScoringRuleDefinition): string {
  const category = SCORING_CATEGORY_LABELS[rule.category] ?? rule.category;
  const positions = formatScoringPositions(rule.positions);
  return `${category} · ${rule.stat} (${positions})`;
}

/**
 * Diff two scoring rule lists into activity-friendly before/after rows.
 * Matches by rule id; reports added, removed, and edited rules.
 */
export function diffScoringRules(
  beforeRules: ScoringRuleDefinition[],
  afterRules: ScoringRuleDefinition[],
): SettingsChange[] {
  const changes: SettingsChange[] = [];
  const afterById = new Map(afterRules.map((rule) => [rule.id, rule]));
  const usedAfterIds = new Set<string>();

  for (const before of beforeRules) {
    const after = afterById.get(before.id);
    if (after) {
      usedAfterIds.add(after.id);
      if (scoringRuleFingerprint(before) === scoringRuleFingerprint(after)) {
        continue;
      }
      changes.push({
        path: `scoringRules.${before.id}`,
        label: scoringRuleLabel(after),
        before: formatScoringRuleText(before),
        after: formatScoringRuleText(after),
      });
      continue;
    }

    changes.push({
      path: `scoringRules.${before.id}`,
      label: scoringRuleLabel(before),
      before: formatScoringRuleText(before),
      after: "Removed",
    });
  }

  for (const after of afterRules) {
    if (usedAfterIds.has(after.id)) continue;
    changes.push({
      path: `scoringRules.${after.id}`,
      label: scoringRuleLabel(after),
      before: "—",
      after: formatScoringRuleText(after),
    });
  }

  return changes;
}

export async function logSettingsUpdated(input: {
  leagueSeasonId: string;
  actorUserId: string;
  section: string;
  label: string;
  changes: SettingsChange[];
}) {
  if (input.changes.length === 0) return;

  const label = formatSettingsActivityLabel(input.label);

  const metadata: LeagueActivityMetadata = {
    settingsSection: input.section,
    settingsLabel: label,
    settingsChanges: input.changes,
  };

  await logLeagueActivity({
    leagueSeasonId: input.leagueSeasonId,
    type: "settings_updated",
    actorUserId: input.actorUserId,
    summary: `Commissioner updated ${label}.`,
    metadata,
  });
}
