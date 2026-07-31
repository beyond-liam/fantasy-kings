import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { jsonEqual } from "@/lib/json-equal";

describe("jsonEqual", () => {
  it("ignores object key order", () => {
    assert.equal(
      jsonEqual({ id: "a", points: 1 }, { points: 1, id: "a" }),
      true,
    );
  });

  it("ignores keys explicitly set to undefined", () => {
    assert.equal(jsonEqual({ id: "a", every: undefined }, { id: "a" }), true);
  });

  it("compares nested arrays of objects", () => {
    assert.equal(
      jsonEqual(
        [{ id: "a", positions: ["QB", "RB"] }],
        [{ positions: ["QB", "RB"], id: "a" }],
      ),
      true,
    );
  });

  it("respects array order", () => {
    assert.equal(jsonEqual(["QB", "RB"], ["RB", "QB"]), false);
  });

  it("detects differing values", () => {
    assert.equal(jsonEqual({ points: 1 }, { points: 2 }), false);
  });

  it("detects extra keys", () => {
    assert.equal(jsonEqual({ id: "a" }, { id: "a", points: 1 }), false);
  });
});
