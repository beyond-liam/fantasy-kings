import "server-only";

import type { ScoringRuleDefinition } from "@/lib/leagues/scoring";
import type { RosterEnrichmentStableData } from "@/lib/roster-enrichment/load-roster-enrichment-stable";

const STABLE_ENRICHMENT_TTL_MS = 5 * 60 * 1000;
const store = new Map<
  string,
  { value: RosterEnrichmentStableData; loadedAt: number }
>();
const inFlight = new Map<string, Promise<RosterEnrichmentStableData>>();

function scoringRulesCacheKey(rules: ScoringRuleDefinition[]): string {
  return rules
    .map((rule) => `${rule.id}:${rule.points}:${rule.stat}`)
    .sort()
    .join("|");
}

export function stableEnrichmentCacheKey(input: {
  nflSeason: string;
  playerIds: string[];
  scoringRules: ScoringRuleDefinition[];
}) {
  const ids = [...input.playerIds].sort().join(",");
  return `${input.nflSeason}:${ids}:${scoringRulesCacheKey(input.scoringRules)}`;
}

export function clearRosterEnrichmentStableCache() {
  store.clear();
  inFlight.clear();
}

export async function getCachedRosterEnrichmentStable(
  key: string,
  loader: () => Promise<RosterEnrichmentStableData>,
): Promise<RosterEnrichmentStableData> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.loadedAt < STABLE_ENRICHMENT_TTL_MS) {
    return hit.value;
  }

  const pending = inFlight.get(key);
  if (pending) {
    return pending;
  }

  const promise = loader()
    .then((value) => {
      store.set(key, { value, loadedAt: Date.now() });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}
