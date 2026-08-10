import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isWithinPauseWindow } from "@/lib/leagues/draft/pause-window";

describe("isWithinPauseWindow", () => {
  it("handles same-day windows", () => {
    assert.equal(
      isWithinPauseWindow(
        new Date("2026-08-10T10:00:00.000Z"),
        "09:00",
        "17:00",
      ),
      true,
    );
    assert.equal(
      isWithinPauseWindow(
        new Date("2026-08-10T08:59:00.000Z"),
        "09:00",
        "17:00",
      ),
      false,
    );
    assert.equal(
      isWithinPauseWindow(
        new Date("2026-08-10T17:00:00.000Z"),
        "09:00",
        "17:00",
      ),
      false,
    );
  });

  it("handles overnight windows", () => {
    assert.equal(
      isWithinPauseWindow(
        new Date("2026-08-10T23:00:00.000Z"),
        "22:00",
        "08:00",
      ),
      true,
    );
    assert.equal(
      isWithinPauseWindow(
        new Date("2026-08-10T07:59:00.000Z"),
        "22:00",
        "08:00",
      ),
      true,
    );
    assert.equal(
      isWithinPauseWindow(
        new Date("2026-08-10T08:00:00.000Z"),
        "22:00",
        "08:00",
      ),
      false,
    );
    assert.equal(
      isWithinPauseWindow(
        new Date("2026-08-10T12:00:00.000Z"),
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
