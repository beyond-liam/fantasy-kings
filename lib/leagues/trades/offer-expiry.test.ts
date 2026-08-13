import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveTradeOfferExpiresAt,
  type TradeOfferExpiryPreset,
} from "@/lib/leagues/trades/offer-expiry";

describe("resolveTradeOfferExpiresAt", () => {
  const now = new Date("2026-08-13T15:00:00.000Z");

  it("returns null for never", () => {
    assert.equal(resolveTradeOfferExpiresAt("never", now), null);
  });

  it("adds relative durations", () => {
    const cases: Array<[TradeOfferExpiryPreset, number]> = [
      ["1h", 60 * 60 * 1000],
      ["24h", 24 * 60 * 60 * 1000],
      ["2d", 2 * 24 * 60 * 60 * 1000],
      ["7d", 7 * 24 * 60 * 60 * 1000],
      ["14d", 14 * 24 * 60 * 60 * 1000],
    ];
    for (const [preset, ms] of cases) {
      const expires = resolveTradeOfferExpiresAt(preset, now);
      assert.ok(expires);
      assert.equal(expires.getTime(), now.getTime() + ms);
    }
  });

  it("uses local end of day", () => {
    const localNow = new Date(2026, 7, 13, 15, 0, 0, 0);
    const expires = resolveTradeOfferExpiresAt("eod", localNow);
    assert.ok(expires);
    assert.equal(expires.getFullYear(), 2026);
    assert.equal(expires.getMonth(), 7);
    assert.equal(expires.getDate(), 13);
    assert.equal(expires.getHours(), 23);
    assert.equal(expires.getMinutes(), 59);
  });
});
