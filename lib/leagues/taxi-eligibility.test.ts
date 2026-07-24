import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isPlayerTaxiEligible,
  resolveTaxiMaxYearsExp,
} from "@/lib/leagues/taxi-eligibility";
import { getTaxiLockViolations } from "@/lib/leagues/taxi-lock";

describe("isPlayerTaxiEligible", () => {
  it("allows rookies only when max is 0", () => {
    assert.equal(isPlayerTaxiEligible(0, 0), true);
    assert.equal(isPlayerTaxiEligible(1, 0), false);
  });

  it("treats 5 as an open ceiling", () => {
    assert.equal(isPlayerTaxiEligible(5, 5), true);
    assert.equal(isPlayerTaxiEligible(12, 5), true);
  });

  it("rejects unknown yearsExp", () => {
    assert.equal(isPlayerTaxiEligible(null, 2), false);
  });
});

describe("resolveTaxiMaxYearsExp", () => {
  it("falls back to rookies only", () => {
    assert.equal(resolveTaxiMaxYearsExp(undefined), 0);
    assert.equal(resolveTaxiMaxYearsExp(9), 0);
  });
});

describe("getTaxiLockViolations", () => {
  it("flags over-experience players on Taxi", () => {
    const violations = getTaxiLockViolations(
      [
        {
          id: "1",
          fullName: "Rookie",
          yearsExp: 0,
          slotPositionId: "TAXI",
        },
        {
          id: "2",
          fullName: "Veteran",
          yearsExp: 4,
          slotPositionId: "TAXI",
        },
        {
          id: "3",
          fullName: "Bench vet",
          yearsExp: 4,
          slotPositionId: "BN",
        },
      ],
      1,
    );
    assert.equal(violations.length, 1);
    assert.equal(violations[0]?.fullName, "Veteran");
  });
});
