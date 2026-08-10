import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isLineupEditingEnabled,
  isRosterTransactionsEnabled,
} from "@/lib/leagues/free-agency";

describe("isLineupEditingEnabled", () => {
  it("allows lineup edits during a live draft while FA stays locked", () => {
    const season = { status: "draft", freeAgencyOpen: false };
    assert.equal(isRosterTransactionsEnabled(season, "live"), false);
    assert.equal(isLineupEditingEnabled(season, "live"), true);
    assert.equal(isLineupEditingEnabled(season, "paused"), true);
  });

  it("follows free agency when the draft is not underway", () => {
    assert.equal(
      isLineupEditingEnabled(
        { status: "recruiting", freeAgencyOpen: false },
        "scheduled",
      ),
      false,
    );
    assert.equal(
      isLineupEditingEnabled(
        { status: "active", freeAgencyOpen: false },
        "complete",
      ),
      true,
    );
  });
});
