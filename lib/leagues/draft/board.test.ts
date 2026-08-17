import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDraftSchedule,
  getNextTeamPickSlot,
  getPicksUntilTeam,
  getRemainingTeamPickSlots,
} from "@/lib/leagues/draft/board";

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

describe("getPicksUntilTeam", () => {
  const schedule = buildDraftSchedule({
    teams: [
      { id: "a", name: "A", draftSlot: 1 },
      { id: "b", name: "B", draftSlot: 2 },
    ],
    rounds: 2,
    style: "linear",
  });

  it("returns 0 when that team is on the clock", () => {
    assert.equal(getPicksUntilTeam(schedule, 0, "a"), 0);
  });

  it("counts picks until the team's next slot", () => {
    assert.equal(getPicksUntilTeam(schedule, 0, "b"), 1);
    assert.equal(getPicksUntilTeam(schedule, 1, "a"), 1);
  });

  it("returns the next slot metadata", () => {
    const next = getNextTeamPickSlot(schedule, 0, "b");
    assert.equal(next?.picksUntil, 1);
    assert.equal(next?.slot.overall, 2);
    assert.equal(next?.slot.round, 1);
  });

  it("returns every remaining slot for the team", () => {
    const remaining = getRemainingTeamPickSlots(schedule, 0, "a");
    assert.deepEqual(
      remaining.map((item) => item.slot.overall),
      [1, 3],
    );
    assert.deepEqual(
      remaining.map((item) => item.picksUntil),
      [0, 2],
    );
  });
});
