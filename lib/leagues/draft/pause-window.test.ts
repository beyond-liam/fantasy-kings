import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isWithinPauseWindow } from "@/lib/leagues/draft/pause-window";

describe("isWithinPauseWindow", () => {
  it("handles same-day windows in UK time", () => {
    // 10:00 BST = 09:00 UTC
    assert.equal(
      isWithinPauseWindow(
        new Date("2026-08-10T09:00:00.000Z"),
        "09:00",
        "17:00",
      ),
      true,
    );
    // 08:59 BST = 07:59 UTC
    assert.equal(
      isWithinPauseWindow(
        new Date("2026-08-10T07:59:00.000Z"),
        "09:00",
        "17:00",
      ),
      false,
    );
    // 17:00 BST = 16:00 UTC (end exclusive)
    assert.equal(
      isWithinPauseWindow(
        new Date("2026-08-10T16:00:00.000Z"),
        "09:00",
        "17:00",
      ),
      false,
    );
  });

  it("handles overnight windows in UK time", () => {
    // 23:00 BST = 22:00 UTC
    assert.equal(
      isWithinPauseWindow(
        new Date("2026-08-10T22:00:00.000Z"),
        "22:00",
        "08:00",
      ),
      true,
    );
    // 07:59 BST = 06:59 UTC
    assert.equal(
      isWithinPauseWindow(
        new Date("2026-08-10T06:59:00.000Z"),
        "22:00",
        "08:00",
      ),
      true,
    );
    // 08:00 BST = 07:00 UTC (end exclusive)
    assert.equal(
      isWithinPauseWindow(
        new Date("2026-08-10T07:00:00.000Z"),
        "22:00",
        "08:00",
      ),
      false,
    );
    // Midday BST
    assert.equal(
      isWithinPauseWindow(
        new Date("2026-08-10T11:00:00.000Z"),
        "22:00",
        "08:00",
      ),
      false,
    );
  });

  it("uses GMT in winter", () => {
    // 07:59 GMT = 07:59 UTC — still in overnight window
    assert.equal(
      isWithinPauseWindow(
        new Date("2026-01-15T07:59:00.000Z"),
        "22:00",
        "08:00",
      ),
      true,
    );
    // 08:00 GMT = 08:00 UTC — resumes
    assert.equal(
      isWithinPauseWindow(
        new Date("2026-01-15T08:00:00.000Z"),
        "22:00",
        "08:00",
      ),
      false,
    );
  });

  it("rejects equal start and end", () => {
    assert.equal(
      isWithinPauseWindow(
        new Date("2026-08-10T12:00:00.000Z"),
        "12:00",
        "12:00",
      ),
      false,
    );
  });
});
