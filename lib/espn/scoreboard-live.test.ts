import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatDownDistance,
  formatLiveClockLabel,
  formatLiveMatchupLabel,
  formatPeriodClockLabel,
  parseGameSituation,
  parsePossessionSide,
} from "@/lib/espn/scoreboard";

describe("formatPeriodClockLabel", () => {
  it("formats regulation as Qn clock", () => {
    assert.equal(formatPeriodClockLabel(1, "15:00"), "Q1 15:00");
    assert.equal(formatPeriodClockLabel(2, "7:32"), "Q2 7:32");
  });

  it("formats overtime without a Q prefix", () => {
    assert.equal(formatPeriodClockLabel(5, "10:00"), "OT 10:00");
    assert.equal(formatPeriodClockLabel(6, "5:00"), "OT2 5:00");
  });
});

describe("formatLiveClockLabel", () => {
  it("returns quarter and clock while live", () => {
    assert.equal(
      formatLiveClockLabel({
        status: "in",
        statusText: "Q1 15:00",
        period: 1,
        displayClock: "15:00",
      }),
      "Q1 15:00",
    );
  });

  it("keeps named stoppages like Halftime", () => {
    assert.equal(
      formatLiveClockLabel({
        status: "in",
        statusText: "Halftime",
        period: 2,
        displayClock: "0:00",
      }),
      "Halftime",
    );
  });
});

describe("formatLiveMatchupLabel", () => {
  it("returns null before kickoff", () => {
    assert.equal(
      formatLiveMatchupLabel({
        status: "pre",
        statusText: "Scheduled",
        period: null,
        displayClock: null,
      }),
      null,
    );
  });

  it("uses quarter and clock while live", () => {
    assert.equal(
      formatLiveMatchupLabel({
        status: "in",
        statusText: "Q1 15:00",
        period: 1,
        displayClock: "15:00",
      }),
      "Live: Q1 15:00",
    );
  });

  it("keeps named stoppages like Halftime", () => {
    assert.equal(
      formatLiveMatchupLabel({
        status: "in",
        statusText: "Halftime",
        period: 2,
        displayClock: "0:00",
      }),
      "Live: Halftime",
    );
  });
});

describe("parsePossessionSide", () => {
  const sides = {
    home: { id: "21", teamId: "8", abbreviation: "DET" },
    away: { id: "22", teamId: "4", abbreviation: "CIN" },
  };

  it("matches ESPN team ids", () => {
    assert.equal(
      parsePossessionSide({ possession: "8", ...sides }),
      "home",
    );
    assert.equal(
      parsePossessionSide({ possession: "4", ...sides }),
      "away",
    );
  });

  it("matches abbreviations", () => {
    assert.equal(
      parsePossessionSide({ possession: "CIN", ...sides }),
      "away",
    );
  });

  it("returns null when possession is missing", () => {
    assert.equal(parsePossessionSide({ possession: null, ...sides }), null);
  });
});

describe("formatDownDistance", () => {
  it("joins short down/distance with the yard line", () => {
    assert.equal(
      formatDownDistance({
        shortDownDistanceText: "2nd & 8",
        possessionText: "CHI 20",
        downDistanceText: "2nd & 8 at CHI 20",
      }),
      "2nd & 8 • CHI 20",
    );
  });

  it("rewrites ESPN at-text when short fields are missing", () => {
    assert.equal(
      formatDownDistance({
        downDistanceText: "1st & Goal at BUF 3",
      }),
      "1st & Goal • BUF 3",
    );
  });
});

describe("parseGameSituation", () => {
  it("returns null when the game is not live", () => {
    assert.equal(
      parseGameSituation(
        { shortDownDistanceText: "2nd & 8", homeTimeouts: 3, awayTimeouts: 2 },
        false,
      ),
      null,
    );
  });

  it("parses timeouts and down/distance while live", () => {
    assert.deepEqual(
      parseGameSituation(
        {
          shortDownDistanceText: "2nd & 8",
          possessionText: "CHI 20",
          homeTimeouts: 3,
          awayTimeouts: 2,
        },
        true,
      ),
      {
        downDistance: "2nd & 8 • CHI 20",
        homeTimeouts: 3,
        awayTimeouts: 2,
      },
    );
  });
});
