import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatDraftStartsAt } from "./draft-status";

describe("formatDraftStartsAt", () => {
  it("formats on-the-hour times without minutes", () => {
    const date = new Date(2026, 7, 31, 9, 0, 0, 0);
    assert.equal(
      formatDraftStartsAt(date),
      "Starts at 9am on the 31st August, 2026",
    );
  });

  it("formats afternoon times and ordinal days", () => {
    const date = new Date(2026, 9, 23, 20, 30, 0, 0);
    assert.equal(
      formatDraftStartsAt(date),
      "Starts at 8:30pm on the 23rd October, 2026",
    );
  });
});
