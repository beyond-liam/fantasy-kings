import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mergeProjectedPointsByPlayerId,
  needsPreseasonProjectionFallback,
  resolvePreseasonProjectedPoints,
} from "@/lib/scores/preseason-projections";

describe("needsPreseasonProjectionFallback", () => {
  it("is true only for pre", () => {
    assert.equal(needsPreseasonProjectionFallback("pre"), true);
    assert.equal(needsPreseasonProjectionFallback("regular"), false);
    assert.equal(needsPreseasonProjectionFallback("post"), false);
    assert.equal(needsPreseasonProjectionFallback(undefined), false);
  });
});

describe("mergeProjectedPointsByPlayerId", () => {
  it("fills missing and null from fallback", () => {
    const primary = new Map<string, number | null>([
      ["a", 12],
      ["b", null],
    ]);
    const fallback = new Map<string, number | null>([
      ["a", 99],
      ["b", 8],
      ["c", 5],
    ]);
    assert.deepEqual(
      [...mergeProjectedPointsByPlayerId(primary, fallback).entries()],
      [
        ["a", 12],
        ["b", 8],
        ["c", 5],
      ],
    );
  });
});

describe("resolvePreseasonProjectedPoints", () => {
  it("replaces wholesale when primary has no positive pts", () => {
    const primary = new Map<string, number | null>([
      ["a", 0],
      ["b", null],
    ]);
    const fallback = new Map<string, number | null>([
      ["a", 14],
      ["b", 9],
    ]);
    assert.deepEqual(
      [...resolvePreseasonProjectedPoints(primary, fallback).entries()],
      [
        ["a", 14],
        ["b", 9],
      ],
    );
  });

  it("merges gaps when primary already has positive pts", () => {
    const primary = new Map<string, number | null>([
      ["a", 11],
      ["b", null],
    ]);
    const fallback = new Map<string, number | null>([
      ["a", 99],
      ["b", 7],
    ]);
    assert.deepEqual(
      [...resolvePreseasonProjectedPoints(primary, fallback).entries()],
      [
        ["a", 11],
        ["b", 7],
      ],
    );
  });
});
