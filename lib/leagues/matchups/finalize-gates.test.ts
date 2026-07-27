import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { finalizeMaxWeek, shouldFinalizeAfterSync } from "./finalize-gates";

describe("finalizeMaxWeek", () => {
  it("caps at regularSeasonEndWeek when no playoffs", () => {
    assert.equal(
      finalizeMaxWeek({ inputWeek: 15, regularSeasonEndWeek: 14 }),
      14,
    );
  });

  it("caps at playoffEndWeek when provided", () => {
    assert.equal(
      finalizeMaxWeek({
        inputWeek: 16,
        regularSeasonEndWeek: 14,
        playoffEndWeek: 16,
      }),
      16,
    );
  });

  it("caps at week 18", () => {
    assert.equal(
      finalizeMaxWeek({
        inputWeek: 20,
        regularSeasonEndWeek: 19,
        playoffEndWeek: 19,
      }),
      18,
    );
  });

  it("returns inputWeek when it's the minimum", () => {
    assert.equal(
      finalizeMaxWeek({ inputWeek: 10, regularSeasonEndWeek: 14 }),
      10,
    );
  });

  it("includes playoff weeks through championship when input allows", () => {
    assert.equal(
      finalizeMaxWeek({
        inputWeek: 16,
        regularSeasonEndWeek: 14,
        playoffEndWeek: 16,
      }),
      16,
    );
    assert.equal(
      finalizeMaxWeek({
        inputWeek: 15,
        regularSeasonEndWeek: 14,
        playoffEndWeek: 16,
      }),
      15,
    );
  });
});

describe("shouldFinalizeAfterSync", () => {
  it("returns false when Sleeper skipped", () => {
    assert.equal(
      shouldFinalizeAfterSync({ sleeperSkipped: true }),
      false,
    );
  });

  it("returns true when not skipped (regardless of upsert count)", () => {
    assert.equal(
      shouldFinalizeAfterSync({ sleeperSkipped: false }),
      true,
    );
  });
});
