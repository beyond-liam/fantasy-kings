import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findBlockedGameStartCut,
  findBlockedGameStartMoves,
} from "@/lib/leagues/roster/game-start-lock";
import {
  hasUpcomingKickoffWithinHours,
  tradeNeedsWeekEndHold,
} from "@/lib/leagues/trades/week-hold";

describe("game start roster lock", () => {
  it("blocks cuts and slot moves when the player's game has started", () => {
    const started = new Set(["KC"]);
    assert.match(
      findBlockedGameStartCut({
        preventCutsAfterGameStart: true,
        startedTeams: started,
        fullName: "Patrick Mahomes",
        nflTeam: "KC",
      }) ?? "",
      /can't be cut/,
    );
    assert.match(
      findBlockedGameStartMoves({
        preventCutsAfterGameStart: true,
        startedTeams: started,
        changes: [
          {
            fullName: "Patrick Mahomes",
            nflTeam: "KC",
            previousSlot: "BN",
            nextSlot: "QB",
          },
        ],
      }) ?? "",
      /slot is locked/,
    );
  });

  it("allows moves when the setting is off", () => {
    assert.equal(
      findBlockedGameStartCut({
        preventCutsAfterGameStart: false,
        startedTeams: new Set(["KC"]),
        fullName: "Patrick Mahomes",
        nflTeam: "KC",
      }),
      null,
    );
  });
});

describe("trade week hold", () => {
  it("detects started players and upcoming kickoffs within 24h", () => {
    assert.equal(
      tradeNeedsWeekEndHold({
        nflTeams: ["KC", "BUF"],
        startedTeams: new Set(["KC"]),
      }),
      true,
    );
    const now = new Date(Date.UTC(2026, 6, 16, 12, 0, 0));
    assert.equal(
      hasUpcomingKickoffWithinHours({
        now,
        hours: 24,
        kickoffs: [new Date(Date.UTC(2026, 6, 17, 0, 0, 0))],
      }),
      true,
    );
    assert.equal(
      hasUpcomingKickoffWithinHours({
        now,
        hours: 24,
        kickoffs: [new Date(Date.UTC(2026, 6, 18, 0, 0, 0))],
      }),
      false,
    );
  });
});
