import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { reservePlacementFromAcquisition } from "@/lib/leagues/activity-log";

describe("reservePlacementFromAcquisition", () => {
  it("returns ir_added for IR slots", () => {
    assert.deepEqual(
      reservePlacementFromAcquisition({
        slotPositionId: "IR",
        teamName: "Lions",
        playerName: "Zach Charbonnet",
      }),
      {
        type: "ir_added",
        summary: "Lions added Zach Charbonnet to IR",
      },
    );
  });

  it("returns taxi_added for Taxi slots", () => {
    assert.deepEqual(
      reservePlacementFromAcquisition({
        slotPositionId: "TAXI",
        teamName: "Lions",
        playerName: "Rookie",
      }),
      {
        type: "taxi_added",
        summary: "Lions moved Rookie to their taxi squad",
      },
    );
  });

  it("returns null for active slots", () => {
    assert.equal(
      reservePlacementFromAcquisition({
        slotPositionId: "RB",
        teamName: "Lions",
        playerName: "Zach Charbonnet",
      }),
      null,
    );
  });
});
