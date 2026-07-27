import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { finalizeMaxWeek, shouldFinalizeAfterSync } from "./finalize-gates";

describe("finalizeMaxWeek", () => {
  it("caps at regularSeasonEndWeek", () => {
    assert.equal(
      finalizeMaxWeek({ inputWeek: 15, regularSeasonEndWeek: 14 }),
      14,
    );
  });

  it("caps at week 18", () => {
    assert.equal(
      finalizeMaxWeek({ inputWeek: 20, regularSeasonEndWeek: 19 }),
      18,
    );
  });

  it("returns inputWeek when it's the minimum", () => {
    assert.equal(
      finalizeMaxWeek({ inputWeek: 10, regularSeasonEndWeek: 14 }),
      10,
    );
  });

  it("does not include regularSeasonEndWeek + 1 (playoff week)", () => {
    assert.equal(
      finalizeMaxWeek({ inputWeek: 15, regularSeasonEndWeek: 14 }),
      14,
    );
    assert.notEqual(
      finalizeMaxWeek({ inputWeek: 15, regularSeasonEndWeek: 14 }),
      15,
    );
  });
});

describe("shouldFinalizeAfterSync", () => {
  it("returns false when Sleeper skipped", () => {
    assert.equal(
      shouldFinalizeAfterSync({ sleeperSkipped: true, upserted: 100 }),
      false,
    );
  });

  it("returns false when upserted is 0", () => {
    assert.equal(
      shouldFinalizeAfterSync({ sleeperSkipped: false, upserted: 0 }),
      false,
    );
  });

  it("returns true when not skipped and upserted > 0", () => {
    assert.equal(
      shouldFinalizeAfterSync({ sleeperSkipped: false, upserted: 50 }),
      true,
    );
  });
});
