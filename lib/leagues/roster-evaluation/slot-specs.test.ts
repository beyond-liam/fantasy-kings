import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { buildStarterSlotSpecs } from "@/lib/leagues/roster-evaluation/slot-specs";

describe("buildStarterSlotSpecs", () => {
  it("orders IDP starters after skill positions", () => {
    const slots: RosterSlotConfig[] = [
      { positionId: "LB", slotCount: 2, minSlots: 2, maxSlots: 4, isStarter: true },
      { positionId: "QB", slotCount: 1, minSlots: 1, maxSlots: 4, isStarter: true },
      { positionId: "CB", slotCount: 2, minSlots: 2, maxSlots: 4, isStarter: true },
      { positionId: "BN", slotCount: 5, minSlots: 0, maxSlots: 5, isStarter: false },
    ];

    assert.deepEqual(
      buildStarterSlotSpecs(slots).map((spec) => spec.slotLabel),
      ["QB", "CB1", "CB2", "LB1", "LB2"],
    );
  });
});
