import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parsePositionFilter,
  positionFiltersFromRosterSlots,
} from "@/lib/rankings/column-config";

describe("positionFiltersFromRosterSlots", () => {
  it("returns only rostered primary positions in display order", () => {
    assert.deepEqual(
      positionFiltersFromRosterSlots([
        { positionId: "LB" },
        { positionId: "QB" },
        { positionId: "FLEX" },
        { positionId: "WR" },
        { positionId: "BN" },
      ]),
      ["QB", "WR", "LB"],
    );
  });

  it("falls back to the full list when no filterable slots exist", () => {
    assert.deepEqual(positionFiltersFromRosterSlots([{ positionId: "BN" }]), [
      "QB",
      "RB",
      "WR",
      "TE",
      "K",
      "DEF",
      "CB",
      "S",
      "DT",
      "DE",
      "LB",
    ]);
  });
});

describe("parsePositionFilter", () => {
  it("rejects positions outside the allowed league list", () => {
    assert.equal(parsePositionFilter("CB", ["QB", "RB", "WR"]), "QB");
    assert.equal(parsePositionFilter("WR", ["QB", "RB", "WR"]), "WR");
  });
});
