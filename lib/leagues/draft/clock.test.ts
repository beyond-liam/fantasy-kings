import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeTurnExpiresAt,
  formatPickClock,
  secondsUntil,
} from "@/lib/leagues/draft/clock";

describe("formatPickClock", () => {
  it("keeps sub-minute clocks as seconds", () => {
    assert.equal(formatPickClock(0), "0s");
    assert.equal(formatPickClock(20), "20s");
    assert.equal(formatPickClock(59), "59s");
  });

  it("formats minute clocks as M:SS", () => {
    assert.equal(formatPickClock(60), "1:00");
    assert.equal(formatPickClock(90), "1:30");
    assert.equal(formatPickClock(599), "9:59");
  });

  it("formats hour clocks as H:MM:SS", () => {
    assert.equal(formatPickClock(3600), "1:00:00");
    assert.equal(formatPickClock(3661), "1:01:01");
    assert.equal(formatPickClock(8 * 3600), "8:00:00");
  });
});

describe("computeTurnExpiresAt", () => {
  it("returns null when unlimited", () => {
    assert.equal(computeTurnExpiresAt(new Date(), 0), null);
  });

  it("adds the pick window from now", () => {
    const now = new Date("2026-08-05T12:00:00.000Z");
    const expires = computeTurnExpiresAt(now, 120);
    assert.equal(expires?.toISOString(), "2026-08-05T12:02:00.000Z");
    assert.equal(secondsUntil(expires!, now), 120);
  });
});
