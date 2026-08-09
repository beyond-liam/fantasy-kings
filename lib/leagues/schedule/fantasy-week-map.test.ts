import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  espnPreseasonWeekToUser,
  fantasyChampionshipWeek,
  fantasyRegularSeasonEndWeek,
  fantasyWeekFromNflState,
  fantasyWeekToNfl,
  nflToFantasyWeek,
  preseasonFantasyWeekCount,
  userPreseasonWeekToEspn,
} from "./fantasy-week-map";

describe("HOF vs preseason week mapping", () => {
  it("maps user Preseason Week 1 to ESPN week 2 (skips HOF)", () => {
    assert.equal(userPreseasonWeekToEspn(1), 2);
    assert.equal(userPreseasonWeekToEspn(3), 4);
    assert.equal(espnPreseasonWeekToUser(1), null);
    assert.equal(espnPreseasonWeekToUser(2), 1);
  });
});

describe("preseasonFantasyWeekCount", () => {
  it("is 0 when preseason is off", () => {
    assert.equal(
      preseasonFantasyWeekCount({
        playEachOtherTimes: 1,
        includePreseason: false,
        preseasonStartWeek: 1,
      }),
      0,
    );
  });

  it("counts from start week through week 3 (excludes HOF)", () => {
    assert.equal(
      preseasonFantasyWeekCount({
        playEachOtherTimes: 1,
        includePreseason: true,
        preseasonStartWeek: 1,
      }),
      3,
    );
    assert.equal(
      preseasonFantasyWeekCount({
        playEachOtherTimes: 1,
        includePreseason: true,
        preseasonStartWeek: 3,
      }),
      1,
    );
  });
});

describe("fantasy week anchors", () => {
  const withPre = {
    playEachOtherTimes: 1 as const,
    includePreseason: true,
    preseasonStartWeek: 1,
  };

  it("extends regular-season and championship by pre count", () => {
    assert.equal(fantasyRegularSeasonEndWeek(14, withPre), 17);
    assert.equal(fantasyChampionshipWeek(17, withPre), 20);
    assert.equal(fantasyRegularSeasonEndWeek(14, null), 14);
  });
});

describe("fantasyWeekToNfl / nflToFantasyWeek", () => {
  const startAt1 = {
    playEachOtherTimes: 1 as const,
    includePreseason: true,
    preseasonStartWeek: 1,
  };

  const startAt3 = {
    playEachOtherTimes: 1 as const,
    includePreseason: true,
    preseasonStartWeek: 3,
  };

  it("maps fantasy Week 1 to ESPN Preseason Week 1 (not HOF)", () => {
    assert.deepEqual(fantasyWeekToNfl(1, startAt1), {
      seasonType: "pre",
      week: 2,
    });
    assert.deepEqual(fantasyWeekToNfl(2, startAt1), {
      seasonType: "pre",
      week: 3,
    });
    assert.deepEqual(fantasyWeekToNfl(3, startAt1), {
      seasonType: "pre",
      week: 4,
    });
    assert.deepEqual(fantasyWeekToNfl(4, startAt1), {
      seasonType: "regular",
      week: 1,
    });
  });

  it("maps pre then regular when starting mid-preseason", () => {
    assert.deepEqual(fantasyWeekToNfl(1, startAt3), {
      seasonType: "pre",
      week: 4,
    });
    assert.deepEqual(fantasyWeekToNfl(2, startAt3), {
      seasonType: "regular",
      week: 1,
    });
  });

  it("round-trips NFL points and rejects HOF", () => {
    assert.equal(
      nflToFantasyWeek({ seasonType: "pre", week: 1 }, startAt1),
      null,
    );
    assert.equal(
      nflToFantasyWeek({ seasonType: "pre", week: 2 }, startAt1),
      1,
    );
    assert.equal(
      nflToFantasyWeek({ seasonType: "pre", week: 4 }, startAt3),
      1,
    );
    assert.equal(
      nflToFantasyWeek({ seasonType: "pre", week: 2 }, startAt3),
      null,
    );
  });

  it("identity-maps when preseason is off", () => {
    const off = {
      playEachOtherTimes: 1 as const,
      includePreseason: false,
      preseasonStartWeek: 1,
    };
    assert.deepEqual(fantasyWeekToNfl(7, off), {
      seasonType: "regular",
      week: 7,
    });
    assert.equal(nflToFantasyWeek({ seasonType: "pre", week: 2 }, off), null);
  });
});

describe("fantasyWeekFromNflState", () => {
  it("uses display_week during preseason", () => {
    assert.equal(
      fantasyWeekFromNflState(
        { season_type: "pre", week: 3, display_week: 3 },
        {
          playEachOtherTimes: 1,
          includePreseason: true,
          preseasonStartWeek: 2,
        },
      ),
      1,
    );
  });

  it("returns null for Hall of Fame week", () => {
    assert.equal(
      fantasyWeekFromNflState(
        { season_type: "pre", week: 1, display_week: 1 },
        {
          playEachOtherTimes: 1,
          includePreseason: true,
          preseasonStartWeek: 1,
        },
      ),
      null,
    );
  });

  it("returns null in offseason", () => {
    assert.equal(
      fantasyWeekFromNflState({ season_type: "off", week: 0 }, null),
      null,
    );
  });
});
