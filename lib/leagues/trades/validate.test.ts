import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  analyzeTradeDrops,
  areTradeDropsSatisfied,
  countDropsNeeded,
  isDropPlayerSelectable,
  validateTradeProposal,
} from "@/lib/leagues/trades/validate";

const rosterSlots = [
  {
    positionId: "RB",
    slotCount: 2,
    minSlots: 0,
    maxSlots: 4,
    isStarter: true,
  },
  {
    positionId: "WR",
    slotCount: 2,
    minSlots: 0,
    maxSlots: 4,
    isStarter: true,
  },
  { positionId: "BN", slotCount: 4, minSlots: 0, maxSlots: 4, isStarter: false },
];

describe("validateTradeProposal", () => {
  it("requires at least one player per side", () => {
    const result = validateTradeProposal({
      proposingTeamId: "a",
      proposingTeamLabel: "A",
      receivingTeamId: "b",
      receivingTeamLabel: "B",
      proposingRoster: [],
      receivingRoster: [],
      proposingOfferIds: [],
      receivingOfferIds: [],
      proposingDropIds: [],
      receivingDropIds: [],
      rosterSlots,
      benchSlots: 4,
      enforceRosterMinimums: false,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.length > 0);
    }
  });

  it("counts drops needed when net roster size increases", () => {
    const proposingRoster = Array.from({ length: 8 }, (_, index) => ({
      id: `p${index}`,
      slotPositionId: "BN",
      primaryPositionId: "RB",
    }));

    const needed = countDropsNeeded({
      roster: proposingRoster,
      offeringIds: ["p0"],
      receiving: [
        { id: "r1", slotPositionId: "RB", primaryPositionId: "RB" },
        { id: "r2", slotPositionId: "RB", primaryPositionId: "RB" },
      ],
      rosterSlots,
      benchSlots: 4,
    });

    assert.equal(needed, 1);
  });
});

describe("analyzeTradeDrops", () => {
  it("marks all players selectable for roster-only overflow", () => {
    const roomySlots = [
      {
        positionId: "RB",
        slotCount: 2,
        minSlots: 0,
        maxSlots: 20,
        isStarter: true,
      },
      {
        positionId: "WR",
        slotCount: 2,
        minSlots: 0,
        maxSlots: 20,
        isStarter: true,
      },
      {
        positionId: "BN",
        slotCount: 4,
        minSlots: 0,
        maxSlots: 4,
        isStarter: false,
      },
    ];
    const roster = Array.from({ length: 8 }, (_, index) => ({
      id: `p${index}`,
      slotPositionId: "BN",
      primaryPositionId: index < 4 ? "RB" : "WR",
    }));

    const analysis = analyzeTradeDrops({
      roster,
      offeringIds: ["p0"],
      receiving: [
        { id: "r1", slotPositionId: "RB", primaryPositionId: "RB" },
        { id: "r2", slotPositionId: "WR", primaryPositionId: "WR" },
      ],
      rosterSlots: roomySlots,
      benchSlots: 4,
    });

    assert.equal(analysis.selectionMode, "all");
    assert.equal(analysis.rosterOverBy, 1);
    assert.equal(analysis.positionOverages.length, 0);
    assert.equal(analysis.dropsNeeded, 1);
    assert.equal(analysis.selectablePositionIds, null);
    assert.ok(isDropPlayerSelectable(analysis, roster[1]));
  });

  it("restricts to over-max positions for position-only overflow", () => {
    // Max WR is 4. Offer 1 RB for 1 WR while already at 4 WRs — flat roster size.
    const roster = [
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `wr${index}`,
        slotPositionId: "WR",
        primaryPositionId: "WR",
      })),
      ...Array.from({ length: 3 }, (_, index) => ({
        id: `rb${index}`,
        slotPositionId: "RB",
        primaryPositionId: "RB",
      })),
    ];

    const analysis = analyzeTradeDrops({
      roster,
      offeringIds: ["rb0"],
      receiving: [
        { id: "new-wr", slotPositionId: "WR", primaryPositionId: "WR" },
      ],
      rosterSlots,
      benchSlots: 4,
    });

    assert.equal(analysis.selectionMode, "positions");
    assert.equal(analysis.rosterOverBy, 0);
    assert.deepEqual(
      analysis.positionOverages.map((overage) => overage.positionId),
      ["WR"],
    );
    assert.equal(analysis.dropsNeeded, 1);
    assert.deepEqual(analysis.selectablePositionIds, ["WR"]);
    assert.equal(isDropPlayerSelectable(analysis, roster[0]), true);
    assert.equal(isDropPlayerSelectable(analysis, roster[4]), false);
  });

  it("disables non-overmax positions when both apply and constrained cover need", () => {
    // Full roster (8). Offer 1 RB, receive 2 WR while already at 4 WR.
    // rosterOverBy=1, WR overBy=2 → dropsNeeded=2. Constrained WRs: 4 >= 2.
    const roster = [
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `wr${index}`,
        slotPositionId: "WR",
        primaryPositionId: "WR",
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `rb${index}`,
        slotPositionId: "RB",
        primaryPositionId: "RB",
      })),
    ];

    const analysis = analyzeTradeDrops({
      roster,
      offeringIds: ["rb0"],
      receiving: [
        { id: "new-wr1", slotPositionId: "WR", primaryPositionId: "WR" },
        { id: "new-wr2", slotPositionId: "WR", primaryPositionId: "WR" },
      ],
      rosterSlots,
      benchSlots: 4,
    });

    assert.equal(analysis.selectionMode, "mixed");
    assert.equal(analysis.rosterOverBy, 1);
    assert.equal(analysis.positionOverages[0]?.overBy, 2);
    assert.equal(analysis.dropsNeeded, 2);
    assert.deepEqual(analysis.selectablePositionIds, ["WR"]);
    assert.equal(isDropPlayerSelectable(analysis, roster[0], [], roster), true);
    assert.equal(
      isDropPlayerSelectable(analysis, roster[5], [], roster),
      false,
    );
    assert.equal(
      isDropPlayerSelectable(analysis, roster[5], ["wr0", "wr1"], roster),
      true,
    );
    assert.equal(
      areTradeDropsSatisfied(analysis, ["wr0", "wr1"], roster),
      true,
    );
    assert.equal(
      areTradeDropsSatisfied(analysis, ["wr0", "rb1"], roster),
      false,
    );
  });
});
