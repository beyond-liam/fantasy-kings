import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { pickOpenReserveAcquisitionSlot } from "@/lib/leagues/roster/reserve-acquisition";

const slots: RosterSlotConfig[] = [
  {
    positionId: "QB",
    slotCount: 1,
    minSlots: 1,
    maxSlots: 1,
    isStarter: true,
  },
  {
    positionId: "BN",
    slotCount: 1,
    minSlots: 0,
    maxSlots: 1,
    isStarter: false,
  },
  {
    positionId: "IR",
    slotCount: 1,
    minSlots: 0,
    maxSlots: 1,
    isStarter: false,
  },
  {
    positionId: "TAXI",
    slotCount: 1,
    minSlots: 0,
    maxSlots: 1,
    isStarter: false,
  },
];

const fullActive = [
  {
    primaryPositionId: "QB",
    slotPositionId: "QB",
  },
  {
    primaryPositionId: "RB",
    slotPositionId: "BN",
  },
];

describe("pickOpenReserveAcquisitionSlot", () => {
  it("prefers open IR when the player is IR-eligible", () => {
    assert.equal(
      pickOpenReserveAcquisitionSlot({
        player: {
          primaryPositionId: "WR",
          injuryStatus: "Out",
          yearsExp: 3,
        },
        rosteredOnTeam: fullActive,
        rosterSlots: slots,
        benchSlots: 1,
        irEnabled: true,
        taxiEnabled: true,
        irEligibleStatuses: ["Out", "IR"],
        taxiMaxYearsExp: 5,
      }),
      "IR",
    );
  });

  it("falls back to Taxi when IR is unavailable but Taxi fits", () => {
    assert.equal(
      pickOpenReserveAcquisitionSlot({
        player: {
          primaryPositionId: "WR",
          injuryStatus: null,
          yearsExp: 0,
        },
        rosteredOnTeam: fullActive,
        rosterSlots: slots,
        benchSlots: 1,
        irEnabled: true,
        taxiEnabled: true,
        irEligibleStatuses: ["Out", "IR"],
        taxiMaxYearsExp: 0,
      }),
      "TAXI",
    );
  });

  it("returns null when no reserve slot fits", () => {
    assert.equal(
      pickOpenReserveAcquisitionSlot({
        player: {
          primaryPositionId: "WR",
          injuryStatus: null,
          yearsExp: 4,
        },
        rosteredOnTeam: [
          ...fullActive,
          { primaryPositionId: "TE", slotPositionId: "IR" },
          { primaryPositionId: "RB", slotPositionId: "TAXI" },
        ],
        rosterSlots: slots,
        benchSlots: 1,
        irEnabled: true,
        taxiEnabled: true,
        irEligibleStatuses: ["Out"],
        taxiMaxYearsExp: 0,
      }),
      null,
    );
  });

  it("blocks Taxi when prevent-readd is on and the player is activated", () => {
    assert.equal(
      pickOpenReserveAcquisitionSlot({
        player: {
          primaryPositionId: "WR",
          injuryStatus: null,
          yearsExp: 0,
          taxiActivated: true,
        },
        rosteredOnTeam: fullActive,
        rosterSlots: slots,
        benchSlots: 1,
        irEnabled: false,
        taxiEnabled: true,
        irEligibleStatuses: [],
        taxiMaxYearsExp: 5,
        taxiPreventReaddAfterActivation: true,
      }),
      null,
    );
  });
});
