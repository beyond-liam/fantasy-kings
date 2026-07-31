import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import {
  applyLocalSlotSwap,
  findSwapCandidates,
} from "@/lib/leagues/roster-slots";

const rosterSlots: RosterSlotConfig[] = [
  { positionId: "QB", slotCount: 1, minSlots: 1, maxSlots: 2, isStarter: true },
  { positionId: "RB", slotCount: 1, minSlots: 1, maxSlots: 4, isStarter: true },
  {
    positionId: "FLEX",
    slotCount: 1,
    minSlots: 1,
    maxSlots: 1,
    isStarter: true,
  },
  { positionId: "BN", slotCount: 3, minSlots: 0, maxSlots: 3, isStarter: false },
];

const players = [
  { id: "qb1", primaryPositionId: "QB", slotPositionId: "QB" },
  { id: "qb2", primaryPositionId: "QB", slotPositionId: "BN" },
  { id: "rb1", primaryPositionId: "RB", slotPositionId: "RB" },
  { id: "rb2", primaryPositionId: "RB", slotPositionId: "BN" },
];

describe("findSwapCandidates", () => {
  it("only offers players eligible for the slot", () => {
    const ids = findSwapCandidates(players, "QB", "qb1").map((p) => p.id);
    assert.deepEqual(ids, ["qb2"]);
  });

  it("skips slots the benched player cannot take over", () => {
    // rb2 shares the bench slot; rb1's RB slot is closed to a QB.
    const ids = findSwapCandidates(players, "BN", "qb2").map((p) => p.id);
    assert.deepEqual(ids, ["qb1"]);
  });

  it("offers every eligible player for an empty slot", () => {
    const ids = findSwapCandidates(players, "FLEX", null).map((p) => p.id);
    assert.deepEqual(ids, ["rb1", "rb2"]);
  });
});

describe("applyLocalSlotSwap", () => {
  it("trades the two players' slots", () => {
    const result = applyLocalSlotSwap(
      players,
      "qb1",
      "qb2",
      rosterSlots,
      3,
    );
    assert.ok("players" in result);
    const bySlot = Object.fromEntries(
      result.players.map((p) => [p.id, p.slotPositionId]),
    );
    assert.equal(bySlot.qb1, "BN");
    assert.equal(bySlot.qb2, "QB");
  });

  it("rejects a swap the position cannot fill", () => {
    const result = applyLocalSlotSwap(
      players,
      "qb1",
      "rb2",
      rosterSlots,
      3,
    );
    assert.ok("error" in result);
  });
});
