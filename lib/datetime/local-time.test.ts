import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyLocalTime, formatLocalTime } from "./local-time";

describe("formatLocalTime / applyLocalTime", () => {
  it("round-trips local wall clock without UTC slice drift", () => {
    const base = new Date(2026, 7, 2, 19, 30, 0, 0);
    const time = formatLocalTime(base);
    assert.equal(time, "19:30");

    const next = applyLocalTime(base, "20:15");
    assert.equal(next.getHours(), 20);
    assert.equal(next.getMinutes(), 15);
    assert.equal(formatLocalTime(next), "20:15");
  });

  it("ignores seconds when present", () => {
    const base = new Date(2026, 7, 2, 12, 0, 0, 0);
    const next = applyLocalTime(base, "09:05:30");
    assert.equal(formatLocalTime(next), "09:05");
    assert.equal(next.getSeconds(), 0);
  });
});
