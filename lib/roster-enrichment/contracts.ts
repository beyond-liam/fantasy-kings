import {
  ROSTER_ENRICHMENT_VERSION,
  type RosterEnrichmentSuccess,
} from "@/lib/roster-enrichment/types";

export function emptyRosterEnrichmentSuccess(): RosterEnrichmentSuccess {
  return {
    ok: true,
    version: ROSTER_ENRICHMENT_VERSION,
    enrichmentByPlayerId: {},
  };
}
