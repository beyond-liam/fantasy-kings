import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatOpposingPositionLabel,
  formatPositionalSosTooltip,
  lookupPositionalSos,
  type PositionalSosTable,
} from "@/lib/players/matchup-difficulty";

function table(): PositionalSosTable {
  return new Map([
    [
      "QB",
      new Map([
        [
          "TB",
          {
            positionId: "QB",
            rank: 31,
            ptsAllowed: 23.18,
            difficulty: "easy" as const,
            teamCount: 32,
          },
        ],
      ]),
    ],
  ]);
}

describe("lookupPositionalSos", () => {
  it("returns the entry for position and opponent", () => {
    const matchup = lookupPositionalSos(table(), "QB", "TB");
    assert.equal(matchup?.rank, 31);
    assert.equal(matchup?.difficulty, "easy");
  });

  it("returns null when the opponent or position is missing", () => {
    assert.equal(lookupPositionalSos(table(), "QB", "BUF"), null);
    assert.equal(lookupPositionalSos(table(), "WR", "TB"), null);
    assert.equal(lookupPositionalSos(table(), null, "TB"), null);
    assert.equal(lookupPositionalSos(null, "QB", "TB"), null);
  });
});

describe("formatPositionalSosTooltip", () => {
  it("matches the SoS wheel headline and rank / pts rows", () => {
    const copy = formatPositionalSosTooltip({
      opponentLabel: "@ TB",
      matchup: {
        positionId: "QB",
        rank: 31,
        ptsAllowed: 23.18,
        difficulty: "easy",
        teamCount: 32,
      },
    });
    assert.equal(copy.headline, "@ TB looks friendly for this position.");
    assert.equal(copy.rankValue, "#31 of 32");
    assert.equal(copy.ptsValue, "23.2 / game");
    assert.equal(
      copy.footnote,
      "#1 gives up the most fantasy points to this position.",
    );
  });
});

describe("formatOpposingPositionLabel", () => {
  it("pluralizes position ids", () => {
    assert.equal(formatOpposingPositionLabel("WR"), "WRs");
    assert.equal(formatOpposingPositionLabel("DEF"), "DEFs");
  });
});
