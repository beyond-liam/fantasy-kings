import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countNonKeepers,
  groupNonKeepersForClearance,
  keepersClearedSummary,
  type RosteredKeeperRow,
} from "@/lib/leagues/keepers/clearance";

function row(
  overrides: Partial<RosteredKeeperRow> &
    Pick<RosteredKeeperRow, "rosterRowId" | "teamId" | "playerId">,
): RosteredKeeperRow {
  return {
    teamName: "Lions",
    ownerName: "Sam",
    playerName: "Player",
    isKeeper: false,
    ...overrides,
  };
}

describe("groupNonKeepersForClearance", () => {
  it("omits keepers and empty teams", () => {
    const grouped = groupNonKeepersForClearance([
      row({
        rosterRowId: "r1",
        teamId: "t1",
        teamName: "Lions",
        playerId: "p1",
        playerName: "Keeper",
        isKeeper: true,
      }),
      row({
        rosterRowId: "r2",
        teamId: "t1",
        teamName: "Lions",
        playerId: "p2",
        playerName: "Cut",
        isKeeper: false,
      }),
      row({
        rosterRowId: "r3",
        teamId: "t2",
        teamName: "Bears",
        playerId: "p3",
        playerName: "Kept",
        isKeeper: true,
      }),
    ]);

    assert.equal(grouped.length, 1);
    assert.equal(grouped[0]?.teamId, "t1");
    assert.deepEqual(
      grouped[0]?.players.map((player) => player.playerName),
      ["Cut"],
    );
  });

  it("sorts teams and players by name", () => {
    const grouped = groupNonKeepersForClearance([
      row({
        rosterRowId: "r1",
        teamId: "t2",
        teamName: "Zebras",
        playerId: "p1",
        playerName: "Zeke",
      }),
      row({
        rosterRowId: "r2",
        teamId: "t1",
        teamName: "Apples",
        playerId: "p2",
        playerName: "Bob",
      }),
      row({
        rosterRowId: "r3",
        teamId: "t1",
        teamName: "Apples",
        playerId: "p3",
        playerName: "Amy",
      }),
    ]);

    assert.deepEqual(
      grouped.map((team) => team.teamName),
      ["Apples", "Zebras"],
    );
    assert.deepEqual(
      grouped[0]?.players.map((player) => player.playerName),
      ["Amy", "Bob"],
    );
  });
});

describe("countNonKeepers", () => {
  it("sums players across teams", () => {
    assert.equal(
      countNonKeepers([
        {
          teamId: "t1",
          teamName: "A",
          ownerName: null,
          players: [
            { playerId: "p1", playerName: "One" },
            { playerId: "p2", playerName: "Two" },
          ],
        },
        {
          teamId: "t2",
          teamName: "B",
          ownerName: "Pat",
          players: [{ playerId: "p3", playerName: "Three" }],
        },
      ]),
      3,
    );
  });
});

describe("keepersClearedSummary", () => {
  it("names the commissioner source", () => {
    assert.equal(
      keepersClearedSummary("commissioner", 1),
      "Commissioner cleared 1 non-keeper",
    );
  });

  it("names the deadline source", () => {
    assert.equal(
      keepersClearedSummary("deadline", 4),
      "Keeper deadline cleared 4 non-keepers",
    );
  });

  it("names the draft start source", () => {
    assert.equal(
      keepersClearedSummary("draft_start", 2),
      "Draft start cleared 2 non-keepers",
    );
  });
});
