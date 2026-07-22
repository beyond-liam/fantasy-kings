import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import {
  countActivePositionPlayers,
  countActiveRosterPlayers,
  countsTowardRosterMax,
  getMaxRosterSize,
  getPositionRosterMax,
  validateActiveRosterCaps,
} from "@/lib/leagues/roster-capacity";

const slots: RosterSlotConfig[] = [
  {
    positionId: "QB",
    slotCount: 1,
    minSlots: 1,
    maxSlots: 2,
    isStarter: true,
  },
  {
    positionId: "RB",
    slotCount: 2,
    minSlots: 2,
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
  {
    positionId: "IR",
    slotCount: 2,
    minSlots: 0,
    maxSlots: 2,
    isStarter: false,
  },
];

describe("getMaxRosterSize", () => {
  it("counts starters and bench only", () => {
    assert.equal(getMaxRosterSize(slots), 7);
  });

  it("falls back to benchSlots when BN missing", () => {
    const withoutBench = slots.filter((slot) => slot.positionId !== "BN");
    assert.equal(getMaxRosterSize(withoutBench, 5), 9);
  });
});

describe("getPositionRosterMax", () => {
  it("uses configured maxSlots for a position", () => {
    assert.equal(getPositionRosterMax(slots, "QB"), 2);
  });

  it("includes FLEX headroom for eligible positions", () => {
    assert.equal(getPositionRosterMax(slots, "RB"), 5);
  });
});

describe("countsTowardRosterMax", () => {
  it("excludes IR and TAXI", () => {
    assert.equal(countsTowardRosterMax("IR", "RB"), false);
    assert.equal(countsTowardRosterMax("TAXI", "WR"), false);
    assert.equal(countsTowardRosterMax("BN", "RB"), true);
    assert.equal(countsTowardRosterMax("RB", "RB"), true);
  });
});

describe("countActiveRosterPlayers", () => {
  it("ignores players on IR and TAXI", () => {
    assert.equal(
      countActiveRosterPlayers([
        { slotPositionId: "QB", primaryPositionId: "QB" },
        { slotPositionId: "IR", primaryPositionId: "RB" },
        { slotPositionId: "TAXI", primaryPositionId: "WR" },
        { slotPositionId: "BN", primaryPositionId: "TE" },
      ]),
      2,
    );
  });
});

describe("countActivePositionPlayers", () => {
  it("ignores same-position players on IR and TAXI", () => {
    assert.equal(
      countActivePositionPlayers(
        [
          { slotPositionId: "RB", primaryPositionId: "RB" },
          { slotPositionId: "IR", primaryPositionId: "RB" },
          { slotPositionId: "BN", primaryPositionId: "RB" },
          { slotPositionId: "WR", primaryPositionId: "WR" },
        ],
        "RB",
      ),
      2,
    );
  });
});

describe("validateActiveRosterCaps", () => {
  it("allows IR and TAXI beyond active max", () => {
    const players = [
      { slotPositionId: "QB", primaryPositionId: "QB" },
      { slotPositionId: "RB", primaryPositionId: "RB" },
      { slotPositionId: "RB", primaryPositionId: "RB" },
      { slotPositionId: "BN", primaryPositionId: "RB" },
      { slotPositionId: "BN", primaryPositionId: "RB" },
      { slotPositionId: "BN", primaryPositionId: "QB" },
      { slotPositionId: "BN", primaryPositionId: "RB" },
      { slotPositionId: "IR", primaryPositionId: "RB" },
      { slotPositionId: "TAXI", primaryPositionId: "QB" },
    ];
    assert.equal(countActiveRosterPlayers(players), 7);
    assert.deepEqual(validateActiveRosterCaps(players, slots), { ok: true });
  });

  it("rejects too many active players", () => {
    const players = Array.from({ length: 8 }, () => ({
      slotPositionId: "BN",
      primaryPositionId: "RB",
    }));
    const result = validateActiveRosterCaps(players, slots);
    assert.equal(result.ok, false);
  });
});
