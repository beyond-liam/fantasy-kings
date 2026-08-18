import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  expiredPickStreakFromSources,
  nextExpiredPickStreak,
} from "@/lib/leagues/draft/expired-pick-streak";

describe("nextExpiredPickStreak", () => {
  it("forces Autopick after two consecutive clock misses when the setting is on", () => {
    const first = nextExpiredPickStreak({
      source: "autopick",
      missedClock: true,
      consecutiveExpiredPicks: 0,
      forcedAutoPick: false,
      forceAutopickAfterTwoExpires: true,
    });
    assert.deepEqual(first, {
      consecutiveExpiredPicks: 1,
      forcedAutoPick: false,
    });

    const second = nextExpiredPickStreak({
      source: "autopick",
      missedClock: true,
      consecutiveExpiredPicks: 1,
      forcedAutoPick: false,
      forceAutopickAfterTwoExpires: true,
    });
    assert.deepEqual(second, {
      consecutiveExpiredPicks: 2,
      forcedAutoPick: true,
      autoPickEnabled: true,
    });
  });

  it("does not force autopick when the commissioner setting is off", () => {
    const second = nextExpiredPickStreak({
      source: "autopick",
      missedClock: true,
      consecutiveExpiredPicks: 1,
      forcedAutoPick: false,
      forceAutopickAfterTwoExpires: false,
    });
    assert.equal(second.forcedAutoPick, false);
    assert.equal(second.consecutiveExpiredPicks, 2);
  });

  it("resets the miss streak on a manual pick and clears forced Autopick", () => {
    const result = nextExpiredPickStreak({
      source: "manual",
      missedClock: false,
      consecutiveExpiredPicks: 2,
      forcedAutoPick: true,
      forceAutopickAfterTwoExpires: true,
    });
    assert.deepEqual(result, {
      consecutiveExpiredPicks: 0,
      forcedAutoPick: false,
      autoPickEnabled: false,
    });
  });

  it("does not count queue autopicks as missed clocks", () => {
    const result = nextExpiredPickStreak({
      source: "autopick",
      missedClock: false,
      consecutiveExpiredPicks: 1,
      forcedAutoPick: false,
      forceAutopickAfterTwoExpires: true,
    });
    assert.equal(result.consecutiveExpiredPicks, 0);
    assert.equal(result.forcedAutoPick, false);
  });
});

describe("expiredPickStreakFromSources", () => {
  it("forces Autopick from two trailing autopicks after earlier manuals", () => {
    const result = expiredPickStreakFromSources(
      ["manual", "manual", "autopick", "autopick"],
      true,
    );
    assert.equal(result.consecutiveExpiredPicks, 2);
    assert.equal(result.forcedAutoPick, true);
    assert.equal(result.autoPickEnabled, true);
  });

  it("does not force when a manual pick breaks the miss streak", () => {
    const result = expiredPickStreakFromSources(
      ["autopick", "autopick", "manual", "autopick"],
      true,
    );
    assert.equal(result.consecutiveExpiredPicks, 1);
    assert.equal(result.forcedAutoPick, false);
  });
});
