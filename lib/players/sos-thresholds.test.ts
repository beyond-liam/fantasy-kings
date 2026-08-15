import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  blendSosRate,
  difficultyFromDefOffenseRank,
  difficultyFromKickerDefenseRank,
  difficultyFromPositionSosRank,
  difficultyFromSosRank,
  rankTeamsBySosRate,
  sosBlendWeights,
  sosHigherRateIsEasier,
  sosRateUnitLabel,
  sosTopNForPosition,
  sosWeeklyAllowedRate,
  summarizeSosSchedule,
} from "@/lib/players/sos-thresholds";

describe("sosBlendWeights", () => {
  it("uses prior only before any scored week", () => {
    assert.deepEqual(sosBlendWeights(0), { prior: 1, current: 0 });
    assert.deepEqual(sosBlendWeights(-1), { prior: 1, current: 0 });
  });

  it("blends through weeks 1–4", () => {
    assert.deepEqual(sosBlendWeights(1), { prior: 3, current: 1 });
    assert.deepEqual(sosBlendWeights(2), { prior: 2, current: 2 });
    assert.deepEqual(sosBlendWeights(3), { prior: 1, current: 3 });
    assert.deepEqual(sosBlendWeights(4), { prior: 0.5, current: 3.5 });
  });

  it("uses current only from week 5", () => {
    assert.deepEqual(sosBlendWeights(5), { prior: 0, current: 1 });
    assert.deepEqual(sosBlendWeights(12), { prior: 0, current: 1 });
  });
});

describe("blendSosRate", () => {
  it("returns prior when current weight is 0", () => {
    assert.equal(blendSosRate(20, 10, { prior: 1, current: 0 }), 20);
  });

  it("returns current when prior weight is 0", () => {
    assert.equal(blendSosRate(20, 10, { prior: 0, current: 1 }), 10);
  });

  it("weights both rates", () => {
    assert.equal(blendSosRate(20, 10, { prior: 3, current: 1 }), 17.5);
    assert.equal(blendSosRate(20, 10, { prior: 2, current: 2 }), 15);
  });

  it("falls back to whichever rate exists", () => {
    assert.equal(blendSosRate(null, 12, { prior: 3, current: 1 }), 12);
    assert.equal(blendSosRate(18, null, { prior: 3, current: 1 }), 18);
    assert.equal(blendSosRate(null, null, { prior: 1, current: 1 }), null);
  });
});

describe("sosTopNForPosition", () => {
  it("uses top scorer for every position", () => {
    assert.equal(sosTopNForPosition("WR"), 1);
    assert.equal(sosTopNForPosition("RB"), 1);
    assert.equal(sosTopNForPosition("TE"), 1);
    assert.equal(sosTopNForPosition("QB"), 1);
    assert.equal(sosTopNForPosition("K"), 1);
  });
});

describe("sosWeeklyAllowedRate", () => {
  it("uses the top scorer only (not a committee mean)", () => {
    assert.equal(sosWeeklyAllowedRate([24, 18, 12, 4, 1], 1), 24);
    assert.equal(sosWeeklyAllowedRate([24, 18, 12], 1), 24);
    assert.equal(sosWeeklyAllowedRate([15], 1), 15);
    assert.equal(sosWeeklyAllowedRate([], 1), null);
  });
});

describe("sosHigherRateIsEasier / sosRateUnitLabel", () => {
  it("ranks high allowed rates first for every position", () => {
    assert.equal(sosHigherRateIsEasier("WR"), true);
    assert.equal(sosHigherRateIsEasier("K"), true);
    assert.equal(sosHigherRateIsEasier("DEF"), true);
    assert.equal(sosRateUnitLabel("DEF"), "allowed/G");
    assert.equal(sosRateUnitLabel("WR"), "allowed/G");
  });
});

describe("rankTeamsBySosRate", () => {
  it("ranks high allowed rates as easy for skill positions", () => {
    const ranked = rankTeamsBySosRate(
      new Map([
        ["HOU", 8],
        ["TEN", 20],
        ["IND", 14],
      ]),
      true,
    );
    assert.equal(ranked.rankByTeam.get("TEN"), 1);
    assert.equal(ranked.rankByTeam.get("IND"), 2);
    assert.equal(ranked.rankByTeam.get("HOU"), 3);
  });

  it("ranks high DEF fantasy allowed as easy", () => {
    const ranked = rankTeamsBySosRate(
      new Map([
        ["KC", 18],
        ["CAR", 6],
        ["BUF", 12],
      ]),
      true,
    );
    assert.equal(ranked.rankByTeam.get("KC"), 1);
    assert.equal(ranked.rankByTeam.get("BUF"), 2);
    assert.equal(ranked.rankByTeam.get("CAR"), 3);
  });
});

describe("summarizeSosSchedule", () => {
  it("labels schedules from mean rank (#1 = easiest)", () => {
    assert.equal(summarizeSosSchedule(5, "WR")?.headline, "Typically easy");
    assert.equal(summarizeSosSchedule(16, "WR")?.headline, "Typically average");
    assert.equal(summarizeSosSchedule(28, "TE")?.headline, "Typically difficult");
    assert.equal(summarizeSosSchedule(4, "DEF")?.headline, "Typically easy");
    assert.equal(summarizeSosSchedule(3, "K")?.headline, "Typically easy");
    assert.equal(summarizeSosSchedule(28, "K")?.headline, "Typically difficult");
  });
});

describe("difficultyFromKickerDefenseRank", () => {
  it("buckets most generous K defenses as easy", () => {
    assert.equal(difficultyFromKickerDefenseRank(1, 32), "easy");
    assert.equal(difficultyFromKickerDefenseRank(8, 32), "easy");
    assert.equal(difficultyFromKickerDefenseRank(9, 32), "mid");
    assert.equal(difficultyFromKickerDefenseRank(23, 32), "mid");
    assert.equal(difficultyFromKickerDefenseRank(24, 32), "hard");
    assert.equal(difficultyFromKickerDefenseRank(32, 32), "hard");
  });
});

describe("difficultyFromPositionSosRank", () => {
  it("treats #1 as easiest for DEF, K, and skill", () => {
    assert.equal(difficultyFromPositionSosRank("DEF", 1), "easy");
    assert.equal(difficultyFromPositionSosRank("K", 1), "easy");
    assert.equal(difficultyFromPositionSosRank("WR", 1), "easy");
    assert.equal(difficultyFromPositionSosRank("QB", 32), "hard");
  });
});

describe("difficultyFromDefOffenseRank", () => {
  it("uses the same easy-first bands as skill SoS", () => {
    assert.equal(difficultyFromDefOffenseRank(1, 32), "easy");
    assert.equal(difficultyFromDefOffenseRank(8, 32), "easy");
    assert.equal(difficultyFromDefOffenseRank(9, 32), "mid");
    assert.equal(difficultyFromDefOffenseRank(23, 32), "mid");
    assert.equal(difficultyFromDefOffenseRank(24, 32), "hard");
    assert.equal(difficultyFromDefOffenseRank(32, 32), "hard");
    assert.equal(difficultyFromDefOffenseRank(null), null);
  });
});

describe("difficultyFromSosRank", () => {
  it("buckets 32 defenses ~8 Easy / 16 Avg / 8 Hard (1 = easiest)", () => {
    assert.equal(difficultyFromSosRank(1, 32), "easy");
    assert.equal(difficultyFromSosRank(8, 32), "easy");
    assert.equal(difficultyFromSosRank(9, 32), "mid");
    assert.equal(difficultyFromSosRank(23, 32), "mid");
    assert.equal(difficultyFromSosRank(24, 32), "hard");
    assert.equal(difficultyFromSosRank(32, 32), "hard");
  });

  it("returns null without a rank", () => {
    assert.equal(difficultyFromSosRank(null), null);
    assert.equal(difficultyFromSosRank(0), null);
  });
});
