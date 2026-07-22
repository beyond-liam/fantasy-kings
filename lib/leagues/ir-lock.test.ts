import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatIrLockMessage,
  getIrLockViolations,
  hasIrAcquisitionLock,
} from "@/lib/leagues/ir-lock";

const eligible = ["Questionable", "IR", "PUP", "Out", "Suspended"] as const;

describe("getIrLockViolations", () => {
  it("flags IR players who are no longer eligible", () => {
    const violations = getIrLockViolations(
      [
        {
          id: "1",
          fullName: "Healthy IR",
          injuryStatus: null,
          slotPositionId: "IR",
        },
        {
          id: "2",
          fullName: "Out on IR",
          injuryStatus: "Out",
          slotPositionId: "IR",
        },
        {
          id: "3",
          fullName: "Q on bench",
          injuryStatus: "Questionable",
          slotPositionId: "BN",
        },
      ],
      eligible,
    );

    assert.equal(violations.length, 1);
    assert.equal(violations[0]?.fullName, "Healthy IR");
  });

  it("does not flag eligible IR designations including Sus", () => {
    assert.equal(
      getIrLockViolations(
        [
          {
            id: "1",
            fullName: "Suspended",
            injuryStatus: "Sus",
            slotPositionId: "IR",
          },
        ],
        eligible,
      ).length,
      0,
    );
  });
});

describe("hasIrAcquisitionLock", () => {
  it("is true when any violation exists", () => {
    assert.equal(
      hasIrAcquisitionLock(
        [
          {
            id: "1",
            fullName: "A",
            injuryStatus: null,
            slotPositionId: "IR",
          },
        ],
        eligible,
      ),
      true,
    );
  });
});

describe("formatIrLockMessage", () => {
  it("names a single violator", () => {
    assert.match(
      formatIrLockMessage([
        { id: "1", fullName: "Chris Olave", injuryStatus: null },
      ]),
      /Chris Olave/,
    );
  });
});
