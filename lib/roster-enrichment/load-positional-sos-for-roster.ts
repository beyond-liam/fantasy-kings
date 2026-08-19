import "server-only";

import type { ScoringRuleDefinition } from "@/lib/leagues/scoring";
import { getPositionalSosTableResult } from "@/lib/queries/positional-sos";
import type { PositionalSosTable } from "@/lib/players/matchup-difficulty";

/** Positional SoS table for roster OPP badges — deferred from initial roster SSR. */
export async function loadPositionalSosForRoster(input: {
  seasonYear: number;
  positionIds: string[];
  scoringRules: ScoringRuleDefinition[];
}): Promise<PositionalSosTable> {
  const unique = [...new Set(input.positionIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return new Map();
  }

  const result = await getPositionalSosTableResult({
    season: String(input.seasonYear),
    positionIds: unique,
    rules: input.scoringRules,
  });

  if (!result.ok) {
    console.warn(
      `[loadPositionalSosForRoster] unavailable season=${input.seasonYear}: ${result.error.message}`,
    );
    return new Map();
  }

  return result.table;
}
