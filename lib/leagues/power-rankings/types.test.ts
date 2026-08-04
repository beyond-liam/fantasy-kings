import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clampPowerScore,
  scalePowerScoresToBarometer,
} from "@/lib/leagues/power-rankings/types";

describe("scalePowerScoresToBarometer", () => {
  it("sets the strongest team to 100 and scales others", () => {
    const scaled = scalePowerScoresToBarometer(
      new Map([
        ["a", 120],
        ["b", 90],
        ["c", 60],
      ]),
    );
    assert.equal(scaled.get("a"), 100);
    assert.equal(scaled.get("b"), 75);
    assert.equal(scaled.get("c"), 50);
  });

  it("returns 100 for a single team with positive strength", () => {
    const scaled = scalePowerScoresToBarometer(new Map([["solo", 42]]));
    assert.equal(scaled.get("solo"), 100);
  });

  it("returns 0 when all strengths are zero", () => {
    const scaled = scalePowerScoresToBarometer(
      new Map([
        ["a", 0],
        ["b", 0],
      ]),
    );
    assert.equal(scaled.get("a"), 0);
    assert.equal(scaled.get("b"), 0);
  });
});

describe("clampPowerScore", () => {
  it("rounds and clamps to 0–100", () => {
    assert.equal(clampPowerScore(100.4), 100);
    assert.equal(clampPowerScore(-3), 0);
    assert.equal(clampPowerScore(72.6), 73);
  });
});
