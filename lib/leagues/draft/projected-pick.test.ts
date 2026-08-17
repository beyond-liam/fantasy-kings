import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatProjectedPickLabel,
  getProjectedPickPlayerId,
  getProjectedPicksByPlayerId,
} from "@/lib/leagues/draft/projected-pick";

function player(id: string, adp: number | null, name = id) {
  return {
    id,
    fullName: name,
    stats: { adp_ppr: adp },
  };
}

describe("getProjectedPickPlayerId", () => {
  const pool = [
    player("late", 30, "Late"),
    player("early", 1.2, "Early"),
    player("mid", 12, "Mid"),
  ];

  it("returns the 1st remaining player when on the clock", () => {
    assert.equal(getProjectedPickPlayerId(pool, new Set(), 0), "early");
  });

  it("returns the Nth remaining player when up in N picks", () => {
    assert.equal(getProjectedPickPlayerId(pool, new Set(), 2), "mid");
    assert.equal(getProjectedPickPlayerId(pool, new Set(), 3), "late");
  });

  it("skips drafted players when counting depth", () => {
    assert.equal(
      getProjectedPickPlayerId(pool, new Set(["early"]), 1),
      "mid",
    );
  });

  it("returns null when depth is past the remaining pool", () => {
    assert.equal(getProjectedPickPlayerId(pool, new Set(), 4), null);
  });

  it("maps each remaining pick onto a different ADP slot", () => {
    const byPlayer = getProjectedPicksByPlayerId(pool, new Set(), [
      { picksUntil: 1, round: 1, overall: 1 },
      { picksUntil: 3, round: 2, overall: 6 },
    ]);
    assert.equal(byPlayer.get("early")?.overall, 1);
    assert.equal(byPlayer.get("late")?.overall, 6);
    assert.equal(byPlayer.has("mid"), false);
  });
});

describe("formatProjectedPickLabel", () => {
  it("matches the Sleeper-style caption", () => {
    assert.equal(
      formatProjectedPickLabel({ round: 3, overall: 23 }),
      "Projected pick: Round 3, Overall #23",
    );
  });
});
