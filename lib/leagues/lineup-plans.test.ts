import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  lineupWeekRelation,
  overlayPlanSlots,
} from "./lineup-plans";

describe("lineupWeekRelation", () => {
  it("classifies past, current, and future weeks", () => {
    assert.equal(lineupWeekRelation(1, 2), "past");
    assert.equal(lineupWeekRelation(2, 2), "current");
    assert.equal(lineupWeekRelation(3, 2), "future");
  });
});

describe("overlayPlanSlots", () => {
  it("keeps live slots when no plan exists", () => {
    const players = [
      { id: "a", slotPositionId: "QB" },
      { id: "b", slotPositionId: "BN" },
    ];
    assert.deepEqual(overlayPlanSlots(players, new Map()), players);
  });

  it("applies planned slots without dropping unplanned players", () => {
    const players = [
      { id: "a", slotPositionId: "QB" },
      { id: "b", slotPositionId: "BN" },
    ];
    const next = overlayPlanSlots(
      players,
      new Map([
        ["a", "BN"],
        ["missing", "RB"],
      ]),
    );
    assert.deepEqual(next, [
      { id: "a", slotPositionId: "BN" },
      { id: "b", slotPositionId: "BN" },
    ]);
  });
});
