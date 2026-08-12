import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { applyLocalSlotAssignment } from "@/lib/leagues/roster-slots";

const rosterSlots: RosterSlotConfig[] = [
  { positionId: "RB", slotCount: 2, minSlots: 2, maxSlots: 6, isStarter: true },
  {
    positionId: "FLEX",
    slotCount: 1,
    minSlots: 1,
    maxSlots: 1,
    isStarter: true,
  },
  { positionId: "BN", slotCount: 5, minSlots: 0, maxSlots: 5, isStarter: false },
];

describe("applyLocalSlotAssignment", () => {
  it("swaps into a full FLEX instead of emptying the vacated starter slot", () => {
    const players = [
      { id: "chase", primaryPositionId: "RB", slotPositionId: "RB" },
      { id: "bijan", primaryPositionId: "RB", slotPositionId: "RB" },
      { id: "breece", primaryPositionId: "RB", slotPositionId: "FLEX" },
      { id: "bench", primaryPositionId: "WR", slotPositionId: "BN" },
    ];

    const result = applyLocalSlotAssignment(
      players,
      "chase",
      "FLEX",
      rosterSlots,
      5,
    );
    assert.ok(!("error" in result));
    const byId = new Map(result.players.map((p) => [p.id, p.slotPositionId]));
    assert.equal(byId.get("chase"), "FLEX");
    assert.equal(byId.get("breece"), "RB");
    assert.equal(byId.get("bijan"), "RB");
    assert.equal(byId.get("bench"), "BN");
  });

  it("benches the occupant when they cannot take the vacated slot", () => {
    const slots: RosterSlotConfig[] = [
      {
        positionId: "QB",
        slotCount: 1,
        minSlots: 1,
        maxSlots: 2,
        isStarter: true,
      },
      {
        positionId: "WR",
        slotCount: 1,
        minSlots: 1,
        maxSlots: 4,
        isStarter: true,
      },
      {
        positionId: "FLEX",
        slotCount: 1,
        minSlots: 1,
        maxSlots: 1,
        isStarter: true,
      },
      {
        positionId: "BN",
        slotCount: 3,
        minSlots: 0,
        maxSlots: 3,
        isStarter: false,
      },
    ];
    const players = [
      { id: "puka", primaryPositionId: "WR", slotPositionId: "WR" },
      { id: "breece", primaryPositionId: "RB", slotPositionId: "FLEX" },
    ];

    // WR → FLEX: Breece (RB) cannot play WR, so he goes to bench.
    const result = applyLocalSlotAssignment(players, "puka", "FLEX", slots, 3);
    assert.ok(!("error" in result));
    const byId = new Map(result.players.map((p) => [p.id, p.slotPositionId]));
    assert.equal(byId.get("puka"), "FLEX");
    assert.equal(byId.get("breece"), "BN");
  });

  it("still blocks reserve players from bumping a full starter slot", () => {
    const players = [
      { id: "chase", primaryPositionId: "RB", slotPositionId: "BN" },
      { id: "breece", primaryPositionId: "RB", slotPositionId: "FLEX" },
    ];

    const result = applyLocalSlotAssignment(
      players,
      "chase",
      "FLEX",
      rosterSlots,
      5,
    );
    assert.ok("error" in result);
    assert.match(result.error, /No open FLEX/);
  });
});
