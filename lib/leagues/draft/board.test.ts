import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDraftSchedule } from "@/lib/leagues/draft/board";

describe("buildDraftSchedule", () => {
  const teams = [
    { id: "a", name: "A", draftSlot: 1 },
    { id: "b", name: "B", draftSlot: 2 },
    { id: "c", name: "C", draftSlot: 3 },
  ];

  it("builds linear order every round", () => {
    const schedule = buildDraftSchedule({
      teams,
      rounds: 2,
      style: "linear",
    });
    assert.deepEqual(
      schedule.map((slot) => slot.teamId),
      ["a", "b", "c", "a", "b", "c"],
    );
  });

  it("snakes even rounds", () => {
    const schedule = buildDraftSchedule({
      teams,
      rounds: 2,
      style: "snake",
    });
    assert.deepEqual(
      schedule.map((slot) => slot.teamId),
      ["a", "b", "c", "c", "b", "a"],
    );
    assert.equal(schedule[3]?.serpentine, true);
  });
});
