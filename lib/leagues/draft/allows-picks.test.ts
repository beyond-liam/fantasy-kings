import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { draftAllowsPicks } from "@/lib/leagues/draft/allows-picks";

describe("draftAllowsPicks", () => {
  it("allows picks while live", () => {
    assert.equal(draftAllowsPicks({ status: "live" }), true);
  });

  it("allows picks during a pause window", () => {
    assert.equal(
      draftAllowsPicks({ status: "paused", pausedByWindow: true }),
      true,
    );
  });

  it("blocks picks for a commissioner pause", () => {
    assert.equal(
      draftAllowsPicks({ status: "paused", pausedByWindow: false }),
      false,
    );
    assert.equal(draftAllowsPicks({ status: "paused" }), false);
  });

  it("blocks picks when not underway", () => {
    assert.equal(draftAllowsPicks({ status: "scheduled" }), false);
    assert.equal(draftAllowsPicks({ status: "complete" }), false);
    assert.equal(draftAllowsPicks({ status: null }), false);
  });
});
