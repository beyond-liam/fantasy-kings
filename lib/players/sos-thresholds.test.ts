import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  blendSosRate,
  difficultyFromSosRank,
  sosBlendWeights,
} from "@/lib/players/sos-thresholds";

describe("sosBlendWeights", () => {
  it("uses prior only before any scored week", () => {
    assert.deepEqual(sosBlendWeights(0), { prior: 1, current: 0 });
    assert.deepEqual(sosBlendWeights(-1), { prior: 1, current: 0 });
  });

  it("blends through weeks 1–4", () => {
    assert.deepEqual(sosBlendWeights(1), { prior: 3, current: 1 });
    assert.deepEqual(sosBlendWeights(2), { prior: 2, current: 2 });
    assert.deepEqual(sosBlendWeights(3), { prior: 1, current: 3 });
    assert.deepEqual(sosBlendWeights(4), { prior: 0.5, current: 3.5 });
  });

  it("uses current only from week 5", () => {
    assert.deepEqual(sosBlendWeights(5), { prior: 0, current: 1 });
    assert.deepEqual(sosBlendWeights(12), { prior: 0, current: 1 });
  });
});

describe("blendSosRate", () => {
  it("returns prior when current weight is 0", () => {
    assert.equal(blendSosRate(20, 10, { prior: 1, current: 0 }), 20);
  });

  it("returns current when prior weight is 0", () => {
    assert.equal(blendSosRate(20, 10, { prior: 0, current: 1 }), 10);
  });

  it("weights both rates", () => {
    assert.equal(blendSosRate(20, 10, { prior: 3, current: 1 }), 17.5);
    assert.equal(blendSosRate(20, 10, { prior: 2, current: 2 }), 15);
  });

  it("falls back to whichever rate exists", () => {
    assert.equal(blendSosRate(null, 12, { prior: 3, current: 1 }), 12);
    assert.equal(blendSosRate(18, null, { prior: 3, current: 1 }), 18);
    assert.equal(blendSosRate(null, null, { prior: 1, current: 1 }), null);
  });
});

describe("difficultyFromSosRank", () => {
  it("buckets 32 defenses ~8 Hard / 16 Avg / 8 Easy (1 = stingiest)", () => {
    assert.equal(difficultyFromSosRank(1, 32), "hard");
    assert.equal(difficultyFromSosRank(8, 32), "hard");
    assert.equal(difficultyFromSosRank(9, 32), "mid");
    assert.equal(difficultyFromSosRank(24, 32), "mid");
    assert.equal(difficultyFromSosRank(25, 32), "easy");
    assert.equal(difficultyFromSosRank(32, 32), "easy");
  });

  it("returns null without a rank", () => {
    assert.equal(difficultyFromSosRank(null), null);
    assert.equal(difficultyFromSosRank(0), null);
  });
});
