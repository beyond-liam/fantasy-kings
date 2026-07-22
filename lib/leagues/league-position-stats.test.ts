import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateStarterPositionPoints,
  buildLeaguePositionStatsRows,
  formatLeaderPositionLabel,
  getLeaderPositionColumns,
} from "@/lib/leagues/league-position-stats";
import type { RosterSlotConfig } from "@/db/schema/league-seasons";

describe("formatLeaderPositionLabel", () => {
  it("maps DEF to D/ST and keeps FLEX as FLEX", () => {
    assert.equal(formatLeaderPositionLabel("FLEX"), "FLEX");
    assert.equal(formatLeaderPositionLabel("DEF"), "D/ST");
    assert.equal(formatLeaderPositionLabel("QB"), "QB");
  });
});

describe("getLeaderPositionColumns", () => {
  it("orders starter slots and skips bench", () => {
    const slots: RosterSlotConfig[] = [
      { positionId: "BN", slotCount: 6, minSlots: 0, maxSlots: 6, isStarter: false },
      { positionId: "DEF", slotCount: 1, minSlots: 1, maxSlots: 3, isStarter: true },
      { positionId: "QB", slotCount: 1, minSlots: 1, maxSlots: 4, isStarter: true },
      { positionId: "FLEX", slotCount: 1, minSlots: 1, maxSlots: 1, isStarter: true },
      { positionId: "RB", slotCount: 2, minSlots: 2, maxSlots: 8, isStarter: true },
    ];

    assert.deepEqual(getLeaderPositionColumns(slots), [
      "QB",
      "RB",
      "FLEX",
      "DEF",
    ]);
  });
});

describe("aggregateStarterPositionPoints", () => {
  it("sums points by starter slot and totals PF", () => {
    const result = aggregateStarterPositionPoints(
      [
        { slotPositionId: "QB", points: 20 },
        { slotPositionId: "RB", points: 10 },
        { slotPositionId: "RB", points: 8 },
        { slotPositionId: "FLEX", points: 12 },
      ],
      ["QB", "RB", "WR", "FLEX"],
    );

    assert.equal(result.byPosition.QB, 20);
    assert.equal(result.byPosition.RB, 18);
    assert.equal(result.byPosition.WR, 0);
    assert.equal(result.byPosition.FLEX, 12);
    assert.equal(result.pointsFor, 50);
  });
});

describe("buildLeaguePositionStatsRows", () => {
  it("ranks claimed teams by PF then optimum", () => {
    const rows = buildLeaguePositionStatsRows(
      [
        {
          teamId: "a",
          teamPublicId: "aaa",
          teamName: "Alpha",
          ownerName: "Ann",
          logoUrl: null,
          claimed: true,
          starters: [{ slotPositionId: "QB", points: 10 }],
          optimumPointsFor: 12,
        },
        {
          teamId: "b",
          teamPublicId: "bbb",
          teamName: "Beta",
          ownerName: "Bob",
          logoUrl: null,
          claimed: true,
          starters: [{ slotPositionId: "QB", points: 20 }],
          optimumPointsFor: 22,
        },
        {
          teamId: "c",
          teamPublicId: null,
          teamName: "Open",
          ownerName: "Unclaimed",
          logoUrl: null,
          claimed: false,
          starters: [],
          optimumPointsFor: 0,
        },
      ],
      ["QB"],
    );

    assert.equal(rows[0]?.teamName, "Beta");
    assert.equal(rows[0]?.rank, 1);
    assert.equal(rows[1]?.teamName, "Alpha");
    assert.equal(rows[1]?.rank, 2);
    assert.equal(rows[2]?.claimed, false);
    assert.equal(rows[2]?.rank, 0);
  });

  it("leaves point columns null when scores are unavailable", () => {
    const rows = buildLeaguePositionStatsRows(
      [
        {
          teamId: "a",
          teamPublicId: "aaa",
          teamName: "Alpha",
          ownerName: "Ann",
          logoUrl: null,
          claimed: true,
          starters: [{ slotPositionId: "QB", points: 10 }],
          optimumPointsFor: 12,
        },
      ],
      ["QB", "RB"],
      { scoresAvailable: false },
    );

    assert.equal(rows[0]?.pointsFor, null);
    assert.equal(rows[0]?.optimumPointsFor, null);
    assert.equal(rows[0]?.byPosition.QB, null);
    assert.equal(rows[0]?.byPosition.RB, null);
  });
});
