import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isDraftAutopickDue } from "@/lib/leagues/draft/autopick-due";

describe("isDraftAutopickDue", () => {
  it("is due when the pick clock has expired", () => {
    assert.equal(
      isDraftAutopickDue({
        isOpenSlot: false,
        enforceExpiry: true,
        hasTurnClock: true,
        clockExpired: true,
      }),
      true,
    );
  });

  it("waits while a claimed timed clock is still running", () => {
    assert.equal(
      isDraftAutopickDue({
        isOpenSlot: false,
        enforceExpiry: true,
        hasTurnClock: true,
        clockExpired: false,
      }),
      false,
    );
  });

  it("autodrafts untimed open seats immediately", () => {
    assert.equal(
      isDraftAutopickDue({
        isOpenSlot: true,
        enforceExpiry: true,
        hasTurnClock: false,
        clockExpired: false,
      }),
      true,
    );
  });

  it("does not autodraft untimed claimed seats", () => {
    assert.equal(
      isDraftAutopickDue({
        isOpenSlot: false,
        enforceExpiry: true,
        hasTurnClock: false,
        clockExpired: false,
      }),
      false,
    );
  });

  it("autodrafts clock-exempt seats without waiting", () => {
    assert.equal(
      isDraftAutopickDue({
        isOpenSlot: false,
        enforceExpiry: true,
        hasTurnClock: true,
        clockExpired: false,
        clockExempt: true,
      }),
      true,
    );
  });
});
