import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import {
  classifyDropCandidatesForMinimums,
  firstRosterMinimumError,
  validateRosterMinimums,
  wouldBreachRosterMinimums,
  wouldOfferingBreachRosterMinimums,
} from "@/lib/leagues/roster-minimums";

const slots: RosterSlotConfig[] = [
  { positionId: "QB", slotCount: 1, minSlots: 1, maxSlots: 3, isStarter: true },
  { positionId: "RB", slotCount: 2, minSlots: 2, maxSlots: 8, isStarter: true },
  { positionId: "WR", slotCount: 2, minSlots: 0, maxSlots: 8, isStarter: true },
];

describe("validateRosterMinimums", () => {
  it("returns no errors when enforce is false", () => {
    assert.deepEqual(
      validateRosterMinimums(
        [{ id: "1", primaryPositionId: "RB", slotPositionId: "RB" }],
        slots,
        false,
      ),
      [],
    );
  });

  it("errors when a required position has zero players", () => {
    const errors = validateRosterMinimums(
      [
        { id: "1", primaryPositionId: "RB", slotPositionId: "RB" },
        { id: "2", primaryPositionId: "RB", slotPositionId: "BN" },
      ],
      slots,
      true,
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /QB/);
  });

  it("ignores IR / taxi toward minimums", () => {
    const errors = validateRosterMinimums(
      [
        { id: "qb", primaryPositionId: "QB", slotPositionId: "IR" },
        { id: "1", primaryPositionId: "RB", slotPositionId: "RB" },
        { id: "2", primaryPositionId: "RB", slotPositionId: "BN" },
      ],
      slots,
      true,
    );
    assert.match(errors[0]!, /QB/);
  });

  it("passes when active counts meet mins", () => {
    assert.deepEqual(
      validateRosterMinimums(
        [
          { id: "qb", primaryPositionId: "QB", slotPositionId: "QB" },
          { id: "1", primaryPositionId: "RB", slotPositionId: "RB" },
          { id: "2", primaryPositionId: "RB", slotPositionId: "BN" },
        ],
        slots,
        true,
      ),
      [],
    );
  });
});

describe("wouldBreachRosterMinimums", () => {
  it("blocks cutting the last active QB", () => {
    assert.equal(
      wouldBreachRosterMinimums({
        roster: [
          { id: "qb", primaryPositionId: "QB", slotPositionId: "QB" },
          { id: "1", primaryPositionId: "RB", slotPositionId: "RB" },
          { id: "2", primaryPositionId: "RB", slotPositionId: "BN" },
        ],
        removeIds: ["qb"],
        rosterSlots: slots,
        enforce: true,
      }),
      true,
    );
  });

  it("allows cutting last QB when adding another QB", () => {
    assert.equal(
      wouldBreachRosterMinimums({
        roster: [
          { id: "qb", primaryPositionId: "QB", slotPositionId: "QB" },
          { id: "1", primaryPositionId: "RB", slotPositionId: "RB" },
          { id: "2", primaryPositionId: "RB", slotPositionId: "BN" },
        ],
        removeIds: ["qb"],
        add: [{ id: "qb2", primaryPositionId: "QB", slotPositionId: null }],
        rosterSlots: slots,
        enforce: true,
      }),
      false,
    );
  });
});

describe("classifyDropCandidatesForMinimums", () => {
  it("marks last QB ineligible and RBs eligible", () => {
    const roster = [
      { id: "qb", primaryPositionId: "QB", slotPositionId: "QB" },
      { id: "1", primaryPositionId: "RB", slotPositionId: "RB" },
      { id: "2", primaryPositionId: "RB", slotPositionId: "BN" },
      { id: "3", primaryPositionId: "RB", slotPositionId: "BN" },
    ];
    const { eligible, ineligible } = classifyDropCandidatesForMinimums({
      candidates: roster,
      roster,
      rosterSlots: slots,
      enforce: true,
    });
    assert.deepEqual(
      eligible.map((p) => p.id).toSorted(),
      ["1", "2", "3"],
    );
    assert.equal(ineligible.length, 1);
    assert.equal(ineligible[0]!.player.id, "qb");
  });
});

describe("wouldOfferingBreachRosterMinimums", () => {
  it("allows offering last QB when receiving a QB", () => {
    assert.equal(
      wouldOfferingBreachRosterMinimums({
        roster: [
          { id: "qb", primaryPositionId: "QB", slotPositionId: "QB" },
          { id: "1", primaryPositionId: "RB", slotPositionId: "RB" },
          { id: "2", primaryPositionId: "RB", slotPositionId: "BN" },
        ],
        offeringIds: [],
        receiving: [
          { id: "their-qb", primaryPositionId: "QB", slotPositionId: "QB" },
        ],
        playerId: "qb",
        rosterSlots: slots,
        enforce: true,
      }),
      false,
    );
  });

  it("blocks offering last QB when not receiving a QB", () => {
    assert.equal(
      wouldOfferingBreachRosterMinimums({
        roster: [
          { id: "qb", primaryPositionId: "QB", slotPositionId: "QB" },
          { id: "1", primaryPositionId: "RB", slotPositionId: "RB" },
          { id: "2", primaryPositionId: "RB", slotPositionId: "BN" },
        ],
        offeringIds: [],
        receiving: [
          { id: "wr", primaryPositionId: "WR", slotPositionId: "WR" },
        ],
        playerId: "qb",
        rosterSlots: slots,
        enforce: true,
      }),
      true,
    );
  });
});

describe("firstRosterMinimumError", () => {
  it("returns null when ok", () => {
    assert.equal(
      firstRosterMinimumError(
        [
          { id: "qb", primaryPositionId: "QB", slotPositionId: "QB" },
          { id: "1", primaryPositionId: "RB", slotPositionId: "RB" },
          { id: "2", primaryPositionId: "RB", slotPositionId: "BN" },
        ],
        slots,
        true,
      ),
      null,
    );
  });
});
