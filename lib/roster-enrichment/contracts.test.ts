import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyRosterEnrichmentSuccess } from "@/lib/roster-enrichment/contracts";
import { ROSTER_ENRICHMENT_VERSION } from "@/lib/roster-enrichment/types";

describe("roster enrichment contract", () => {
  it("returns a stable empty success payload when no players are requested", () => {
    assert.deepEqual(emptyRosterEnrichmentSuccess(), {
      ok: true,
      version: ROSTER_ENRICHMENT_VERSION,
      enrichmentByPlayerId: {},
    });
  });
});
