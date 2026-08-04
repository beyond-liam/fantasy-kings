import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTeammateQbCandidates,
  offenseSnapByWeekFromLogs,
  qbLastName,
  qbPlayedFromStats,
  selectTeamQb1,
  sumWeeklyStatBags,
  withoutQb1ScoredWeeks,
} from "@/lib/players/team-qb1";

describe("qbPlayedFromStats", () => {
  it("treats pass attempts as played", () => {
    assert.equal(qbPlayedFromStats({ pass_att: 22 }), true);
    assert.equal(qbPlayedFromStats({ pass_att: 0, gp: 1 }), false);
  });
});

describe("buildTeammateQbCandidates", () => {
  it("matches QBs by shared tm_off_snp and ignores other-team volume", () => {
    const offenseSnapByWeek = new Map([
      [1, 76],
      [2, 66],
      [8, 50],
    ]);
    const candidates = buildTeammateQbCandidates({
      offenseSnapByWeek,
      qbWeeks: [
        {
          playerId: "penix",
          fullName: "Michael Penix",
          depthChartOrder: 1,
          week: 1,
          stats: { pass_att: 42, tm_off_snp: 76 },
        },
        {
          playerId: "tua",
          fullName: "Tua Tagovailoa",
          depthChartOrder: null,
          week: 1,
          stats: { pass_att: 23, tm_off_snp: 48 },
        },
        {
          playerId: "penix",
          fullName: "Michael Penix",
          depthChartOrder: 1,
          week: 2,
          stats: { pass_att: 21, tm_off_snp: 66 },
        },
        {
          playerId: "cousins",
          fullName: "Kirk Cousins",
          depthChartOrder: null,
          week: 8,
          stats: { pass_att: 31, tm_off_snp: 50 },
        },
      ],
    });

    const byId = new Map(candidates.map((c) => [c.playerId, c]));
    assert.equal(byId.has("tua"), false);
    assert.equal(byId.get("penix")?.passAtt, 63);
    assert.deepEqual(byId.get("penix")?.playedWeeks, [1, 2]);
    assert.equal(byId.get("cousins")?.passAtt, 31);
  });
});

describe("selectTeamQb1", () => {
  it("prefers depth chart order 1 when requested", () => {
    const pick = selectTeamQb1(
      [
        {
          playerId: "a",
          fullName: "Backup Guy",
          depthChartOrder: 2,
          playedWeeks: [1, 2, 3, 4, 5],
          passAtt: 200,
        },
        {
          playerId: "b",
          fullName: "Patrick Mahomes",
          depthChartOrder: 1,
          playedWeeks: [1, 2, 3],
          passAtt: 90,
        },
      ],
      { preferDepthChart: true },
    );
    assert.equal(pick?.playerId, "b");
    assert.equal(pick?.lastName, "Mahomes");
    assert.equal(pick?.source, "depth_chart");
  });

  it("uses most pass attempts when depth chart is off", () => {
    const pick = selectTeamQb1(
      [
        {
          playerId: "a",
          fullName: "Starter One",
          depthChartOrder: 1,
          playedWeeks: [1, 2],
          passAtt: 40,
        },
        {
          playerId: "b",
          fullName: "Volume Two",
          depthChartOrder: 2,
          playedWeeks: [1, 2, 3, 4, 5, 6],
          passAtt: 180,
        },
      ],
      { preferDepthChart: false },
    );
    assert.equal(pick?.playerId, "b");
    assert.equal(pick?.source, "pass_att");
  });
});

describe("withoutQb1ScoredWeeks", () => {
  it("returns player weeks where QB did not play", () => {
    assert.deepEqual(withoutQb1ScoredWeeks([1, 2, 3, 5], [1, 2, 4, 5]), [3]);
  });

  it("does not treat a shared bye as a missed QB game", () => {
    // Player scored W1–9,11–18; QB threw those same weeks (bye W10 omitted).
    const playerScored = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18];
    const qbPlayed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18];
    assert.deepEqual(withoutQb1ScoredWeeks(playerScored, qbPlayed), []);
  });
});

describe("offenseSnapByWeekFromLogs", () => {
  it("collects weekly tm_off_snp", () => {
    const map = offenseSnapByWeekFromLogs([
      { week: 1, stats: { tm_off_snp: 76 } },
      { week: 2, stats: { rush_att: 10 } },
      { week: 3, stats: { tm_off_snp: 50 } },
    ]);
    assert.equal(map.get(1), 76);
    assert.equal(map.has(2), false);
    assert.equal(map.get(3), 50);
  });
});

describe("sumWeeklyStatBags", () => {
  it("sums counting stats and skips ranks", () => {
    assert.deepEqual(
      sumWeeklyStatBags([
        { rush_yd: 50, pos_rank_ppr: 8 },
        { rush_yd: 70, pos_rank_ppr: 3 },
      ]),
      { rush_yd: 120 },
    );
  });
});

describe("qbLastName", () => {
  it("uses the final token", () => {
    assert.equal(qbLastName("Patrick Mahomes"), "Mahomes");
  });
});
