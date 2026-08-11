import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import {
  buildTeamSummaryRosterBreakdown,
  formatWaiverPriority,
  resolveTeamSummaryMatchups,
} from "@/lib/leagues/team-summary";

const slots: RosterSlotConfig[] = [
  {
    positionId: "QB",
    slotCount: 1,
    minSlots: 1,
    maxSlots: 3,
    isStarter: true,
  },
  {
    positionId: "RB",
    slotCount: 2,
    minSlots: 2,
    maxSlots: 8,
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
    slotCount: 5,
    minSlots: 0,
    maxSlots: 5,
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

describe("buildTeamSummaryRosterBreakdown", () => {
  it("counts positions, starters, active, and illegal IR", () => {
    const breakdown = buildTeamSummaryRosterBreakdown({
      players: [
        {
          id: "1",
          fullName: "Starter QB",
          primaryPositionId: "QB",
          injuryStatus: null,
          slotPositionId: "QB",
        },
        {
          id: "2",
          fullName: "Bench RB",
          primaryPositionId: "RB",
          injuryStatus: null,
          slotPositionId: "BN",
        },
        {
          id: "3",
          fullName: "Hurt WR",
          primaryPositionId: "WR",
          injuryStatus: "Healthy",
          slotPositionId: "IR",
        },
      ],
      rosterSlots: slots,
      benchSlots: 5,
      irEnabled: true,
      irSlots: 2,
      irEligibleStatuses: ["IR", "Out"],
      taxiEnabled: false,
      taxiSlots: 0,
    });

    const qb = breakdown.positions.find((row) => row.positionId === "QB");
    const rb = breakdown.positions.find((row) => row.positionId === "RB");
    assert.ok(qb);
    assert.equal(qb.count, 1);
    assert.equal(qb.min, 1);
    assert.equal(qb.max, 3);
    assert.equal(qb.illegal, false);
    assert.ok(rb);
    assert.equal(rb.count, 1);
    assert.equal(rb.max, 9); // 8 + FLEX
    assert.equal(rb.illegal, true); // min 2, only 1 active RB

    assert.equal(breakdown.starters.count, 1);
    assert.equal(breakdown.starters.max, 4);
    assert.equal(breakdown.active.count, 2);
    assert.equal(breakdown.active.max, 9);

    assert.ok(breakdown.ir);
    assert.equal(breakdown.ir.count, 1);
    assert.equal(breakdown.ir.illegal, true);
    assert.equal(breakdown.taxi, null);
  });
});

describe("formatWaiverPriority", () => {
  it("formats ordinals", () => {
    assert.equal(formatWaiverPriority(1), "1st");
    assert.equal(formatWaiverPriority(2), "2nd");
    assert.equal(formatWaiverPriority(3), "3rd");
    assert.equal(formatWaiverPriority(7), "7th");
    assert.equal(formatWaiverPriority(11), "11th");
    assert.equal(formatWaiverPriority(22), "22nd");
    assert.equal(formatWaiverPriority(null), null);
  });
});

describe("resolveTeamSummaryMatchups", () => {
  it("picks previous final and current/next upcoming", () => {
    const { previous, current } = resolveTeamSummaryMatchups(
      [
        {
          week: 1,
          publicId: "aaaaaa",
          opponentName: "A",
          opponentSlug: "a",
          isHome: true,
          status: "final",
          teamPts: 90,
          opponentPts: 100,
        },
        {
          week: 2,
          publicId: "bbbbbb",
          opponentName: "B",
          opponentSlug: "b",
          isHome: false,
          status: "scheduled",
          teamPts: null,
          opponentPts: null,
        },
      ],
      2,
    );

    assert.equal(previous?.opponentName, "A");
    assert.equal(previous?.result, "loss");
    assert.equal(current?.opponentName, "B");
    assert.equal(current?.result, null);
  });
});
