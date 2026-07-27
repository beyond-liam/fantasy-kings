import { describe, expect, it } from "vitest";
import { finalizeMaxWeek, shouldFinalizeAfterSync } from "./finalize-gates";

describe("finalizeMaxWeek", () => {
  it("caps at regularSeasonEndWeek", () => {
    expect(
      finalizeMaxWeek({ inputWeek: 15, regularSeasonEndWeek: 14 }),
    ).toBe(14);
  });

  it("caps at week 18", () => {
    expect(
      finalizeMaxWeek({ inputWeek: 20, regularSeasonEndWeek: 19 }),
    ).toBe(18);
  });

  it("returns inputWeek when it's the minimum", () => {
    expect(
      finalizeMaxWeek({ inputWeek: 10, regularSeasonEndWeek: 14 }),
    ).toBe(10);
  });

  it("does not include regularSeasonEndWeek + 1 (playoff week)", () => {
    expect(
      finalizeMaxWeek({ inputWeek: 15, regularSeasonEndWeek: 14 }),
    ).toBe(14);
    expect(
      finalizeMaxWeek({ inputWeek: 15, regularSeasonEndWeek: 14 }),
    ).not.toBe(15);
  });
});

describe("shouldFinalizeAfterSync", () => {
  it("returns false when Sleeper skipped", () => {
    expect(
      shouldFinalizeAfterSync({ sleeperSkipped: true, upserted: 100 }),
    ).toBe(false);
  });

  it("returns false when upserted is 0", () => {
    expect(
      shouldFinalizeAfterSync({ sleeperSkipped: false, upserted: 0 }),
    ).toBe(false);
  });

  it("returns true when not skipped and upserted > 0", () => {
    expect(
      shouldFinalizeAfterSync({ sleeperSkipped: false, upserted: 50 }),
    ).toBe(true);
  });
});
