import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateStarterPositionPoints,
  applySeasonPositionStats,
  buildLeaguePositionStatsRows,
  formatLeaderPositionFullLabel,
  formatLeaderPositionLabel,
  getLeaderPositionColumns,
} from "@/lib/leagues/league-position-stats";
import type { RosterSlotConfig } from "@/db/schema/league-seasons";

describe("formatLeaderPositionLabel", () => {
  it("keeps position ids as display labels", () => {
    assert.equal(formatLeaderPositionLabel("FLEX"), "FLEX");
    assert.equal(formatLeaderPositionLabel("DEF"), "DEF");
    assert.equal(formatLeaderPositionLabel("QB"), "QB");
  });
});

describe("formatLeaderPositionFullLabel", () => {
  it("uses plain English names for column menus", () => {
    assert.equal(formatLeaderPositionFullLabel("QB"), "Quarterback");
    assert.equal(formatLeaderPositionFullLabel("RB"), "Running back");
    assert.equal(formatLeaderPositionFullLabel("WR"), "Wide receiver");
    assert.equal(formatLeaderPositionFullLabel("TE"), "Tight end");
    assert.equal(formatLeaderPositionFullLabel("FLEX"), "Flex");
    assert.equal(formatLeaderPositionFullLabel("CB"), "Cornerback");
    assert.equal(formatLeaderPositionFullLabel("S"), "Safety");
    assert.equal(formatLeaderPositionFullLabel("DT"), "Defensive tackle");
    assert.equal(formatLeaderPositionFullLabel("DE"), "Defensive end");
    assert.equal(formatLeaderPositionFullLabel("LB"), "Linebacker");
    assert.equal(formatLeaderPositionFullLabel("K"), "Kicker");
    assert.equal(formatLeaderPositionFullLabel("DEF"), "Defense");
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

  it("places IDP starter slots in canonical order", () => {
    const slots: RosterSlotConfig[] = [
      { positionId: "QB", slotCount: 1, minSlots: 1, maxSlots: 4, isStarter: true },
      { positionId: "LB", slotCount: 2, minSlots: 2, maxSlots: 4, isStarter: true },
      { positionId: "CB", slotCount: 2, minSlots: 2, maxSlots: 4, isStarter: true },
      { positionId: "DE", slotCount: 2, minSlots: 2, maxSlots: 4, isStarter: true },
      { positionId: "BN", slotCount: 6, minSlots: 0, maxSlots: 6, isStarter: false },
    ];

    assert.deepEqual(getLeaderPositionColumns(slots), [
      "QB",
      "CB",
      "DE",
      "LB",
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

describe("applySeasonPositionStats", () => {
  it("replaces weekly points with summed season snapshots and re-ranks", () => {
    const weekly = buildLeaguePositionStatsRows(
      [
        {
          teamId: "a",
          teamPublicId: "aaaaaa",
          teamName: "A",
          ownerName: "Ann",
          logoUrl: null,
          claimed: true,
          starters: [{ slotPositionId: "QB", points: 10 }],
          optimumPointsFor: 12,
        },
        {
          teamId: "b",
          teamPublicId: "bbbbbb",
          teamName: "B",
          ownerName: "Bob",
          logoUrl: null,
          claimed: true,
          starters: [{ slotPositionId: "QB", points: 30 }],
          optimumPointsFor: 32,
        },
      ],
      ["QB"],
    );
    assert.equal(weekly[0]?.teamId, "b");

    const rows = applySeasonPositionStats(
      weekly,
      ["QB"],
      new Map([["a", 100]]),
      new Map([
        ["a", { pointsFor: 40, optimumPointsFor: 50, byPosition: { QB: 40 } }],
        ["b", { pointsFor: 20, optimumPointsFor: 22, byPosition: { QB: 20 } }],
      ]),
    );

    assert.equal(rows[0]?.teamId, "a");
    assert.equal(rows[0]?.pointsFor, 40);
    assert.equal(rows[0]?.byPosition.QB, 40);
    assert.equal(rows[0]?.optimumPointsFor, 50);
    assert.equal(rows[0]?.rank, 1);
    assert.equal(rows[1]?.teamId, "b");
    assert.equal(rows[1]?.pointsFor, 20);
  });
});
