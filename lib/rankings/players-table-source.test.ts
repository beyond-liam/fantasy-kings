import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { overlayScoreKind, type ScoreRow } from "@/lib/queries/score-rows";
import {
  DEFAULT_POINTS_SORT_COLUMN,
  DEFAULT_SORT_COLUMN,
  parseRequestedSort,
  playersTableKindQueryValue,
  resolvePlayersTableKind,
  sortingToParams,
} from "@/lib/rankings/sort-params";

function row(
  partial: Pick<ScoreRow, "id" | "fullName"> & Partial<ScoreRow>,
): ScoreRow {
  return {
    nflTeam: "KC",
    primaryPositionId: "QB",
    sleeperId: null,
    yearsExp: 3,
    byeWeek: 10,
    injuryStatus: null,
    rookieYear: null,
    stats: {},
    ptsPpr: null,
    ptsStd: null,
    ...partial,
  };
}

describe("overlayScoreKind", () => {
  it("keeps the universe player set and overlays stats", () => {
    const universe = [
      row({
        id: "a",
        fullName: "Alpha",
        stats: { pass_yd: 4000 },
        ptsPpr: 300,
      }),
      row({ id: "b", fullName: "Bravo", stats: { pass_yd: 3500 }, ptsPpr: 250 }),
    ];
    const overlay = [
      row({ id: "b", fullName: "Bravo", stats: { pass_yd: 120 }, ptsPpr: 18 }),
      row({ id: "c", fullName: "Charlie", stats: { pass_yd: 90 }, ptsPpr: 12 }),
    ];

    const merged = overlayScoreKind(universe, overlay);
    assert.deepEqual(
      merged.map((r) => r.id),
      ["a", "b"],
    );
    assert.equal(merged[0]?.ptsPpr, null);
    assert.deepEqual(merged[0]?.stats, {});
    assert.equal(merged[1]?.ptsPpr, 18);
    assert.equal(merged[1]?.stats.pass_yd, 120);
  });
});

describe("resolvePlayersTableKind", () => {
  it("defaults to projections before counting games start", () => {
    assert.equal(resolvePlayersTableKind(undefined, false), "projection");
  });

  it("defaults to stats once counting games have started", () => {
    assert.equal(resolvePlayersTableKind(undefined, true), "stats");
    assert.equal(resolvePlayersTableKind(null, true), "stats");
  });

  it("honors an explicit kind param", () => {
    assert.equal(resolvePlayersTableKind("projection", true), "projection");
    assert.equal(resolvePlayersTableKind("stats", false), "stats");
  });
});

describe("playersTableKindQueryValue", () => {
  it("omits stats from the URL once the season is underway", () => {
    assert.equal(playersTableKindQueryValue("stats", true), null);
    assert.equal(playersTableKindQueryValue("projection", true), "projection");
  });

  it("omits projection from the URL before the season starts", () => {
    assert.equal(playersTableKindQueryValue("projection", false), null);
    assert.equal(playersTableKindQueryValue("stats", false), "stats");
  });
});

describe("parseRequestedSort", () => {
  it("defaults to rank ascending", () => {
    assert.deepEqual(parseRequestedSort(), {
      sort: DEFAULT_SORT_COLUMN,
      sortDesc: false,
    });
  });

  it("maps legacy pts_ppr to fantasy points descending", () => {
    assert.deepEqual(parseRequestedSort("pts_ppr"), {
      sort: DEFAULT_POINTS_SORT_COLUMN,
      sortDesc: true,
    });
  });

  it("treats omitted sortDir as descending for points", () => {
    assert.deepEqual(parseRequestedSort("fantasy_pts"), {
      sort: "fantasy_pts",
      sortDesc: true,
    });
  });
});

describe("sortingToParams", () => {
  it("omits rank ascending from the URL", () => {
    assert.deepEqual(
      sortingToParams([{ id: "positionRank", desc: false }]),
      { sort: null, sortDir: null },
    );
  });

  it("writes sortDir=desc when ranking high-to-low", () => {
    assert.deepEqual(
      sortingToParams([{ id: "positionRank", desc: true }]),
      { sort: null, sortDir: "desc" },
    );
  });

  it("omits sortDir for fantasy points descending", () => {
    assert.deepEqual(
      sortingToParams([{ id: "fantasy_pts", desc: true }]),
      { sort: "fantasy_pts", sortDir: null },
    );
  });
});
