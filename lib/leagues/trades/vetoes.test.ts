import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countEligibleVetoVoters,
  vetoThreshold,
} from "@/lib/leagues/trades/vetoes";

describe("trade vetoes", () => {
  it("requires majority of non-involved managers", () => {
    assert.equal(countEligibleVetoVoters(10), 8);
    assert.equal(vetoThreshold(8), 5);
    assert.equal(vetoThreshold(2), 2);
  });
});
