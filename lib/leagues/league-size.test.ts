import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isBotManagerDisplayName } from "@/lib/leagues/league-size";

describe("isBotManagerDisplayName", () => {
  it("matches commissioner bot managers", () => {
    assert.equal(isBotManagerDisplayName("Bot Manager 1"), true);
    assert.equal(isBotManagerDisplayName("Bot Manager 12"), true);
  });

  it("rejects real managers and team names", () => {
    assert.equal(isBotManagerDisplayName("Test User"), false);
    assert.equal(isBotManagerDisplayName("Bot Team 1"), false);
    assert.equal(isBotManagerDisplayName(null), false);
  });
});
