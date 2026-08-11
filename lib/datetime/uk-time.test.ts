import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ukMinutesOfDay, ukTimezoneAbbrev } from "@/lib/datetime/uk-time";

describe("ukMinutesOfDay", () => {
  it("uses BST offset in summer", () => {
    // 2026-08-11 07:30 UTC = 08:30 BST
    assert.equal(
      ukMinutesOfDay(new Date("2026-08-11T07:30:00.000Z")),
      8 * 60 + 30,
    );
  });

  it("uses GMT offset in winter", () => {
    // 2026-01-15 07:30 UTC = 07:30 GMT
    assert.equal(
      ukMinutesOfDay(new Date("2026-01-15T07:30:00.000Z")),
      7 * 60 + 30,
    );
  });
});

describe("ukTimezoneAbbrev", () => {
  it("returns BST in summer", () => {
    assert.equal(
      ukTimezoneAbbrev(new Date("2026-08-11T12:00:00.000Z")),
      "BST",
    );
  });

  it("returns GMT in winter", () => {
    assert.equal(
      ukTimezoneAbbrev(new Date("2026-01-15T12:00:00.000Z")),
      "GMT",
    );
  });
});
