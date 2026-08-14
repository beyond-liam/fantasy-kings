import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getStatColumns,
  parsePositionFilter,
  positionFiltersFromRosterSlots,
} from "@/lib/rankings/column-config";

describe("positionFiltersFromRosterSlots", () => {
  it("returns only rostered primary positions in display order", () => {
    assert.deepEqual(
      positionFiltersFromRosterSlots([
        { positionId: "LB" },
        { positionId: "QB" },
        { positionId: "FLEX" },
        { positionId: "WR" },
        { positionId: "BN" },
      ]),
      ["QB", "WR", "LB"],
    );
  });

  it("falls back to the full list when no filterable slots exist", () => {
    assert.deepEqual(positionFiltersFromRosterSlots([{ positionId: "BN" }]), [
      "QB",
      "RB",
      "WR",
      "TE",
      "K",
      "DEF",
      "CB",
      "S",
      "DT",
      "DE",
      "LB",
    ]);
  });
});

describe("parsePositionFilter", () => {
  it("rejects positions outside the allowed league list", () => {
    assert.equal(parsePositionFilter("CB", ["QB", "RB", "WR"]), "QB");
    assert.equal(parsePositionFilter("WR", ["QB", "RB", "WR"]), "WR");
  });
});

describe("getStatColumns", () => {
  it("orders counting stats by position", () => {
    assert.deepEqual(
      getStatColumns("QB").map((column) => column.key),
      [
        "fantasy_pts",
        "adp",
        "pass_att",
        "pass_cmp",
        "pass_yd",
        "pass_td",
        "pass_int",
        "rush_att",
        "rush_yd",
        "rush_td",
      ],
    );
    assert.deepEqual(
      getStatColumns("RB").map((column) => column.key),
      [
        "fantasy_pts",
        "adp",
        "rush_att",
        "rush_yd",
        "rush_td",
        "fum",
        "rec",
        "rec_tgt",
        "rec_yd",
        "rec_td",
      ],
    );
    assert.deepEqual(
      getStatColumns("WR").map((column) => column.key),
      getStatColumns("TE").map((column) => column.key),
    );
    assert.deepEqual(
      getStatColumns("WR").map((column) => column.key),
      [
        "fantasy_pts",
        "adp",
        "rec",
        "rec_tgt",
        "rec_yd",
        "rec_td",
        "rush_att",
        "rush_yd",
        "rush_td",
      ],
    );
    assert.deepEqual(
      getStatColumns("K").map((column) => column.key),
      [
        "fantasy_pts",
        "adp",
        "fga",
        "fgm",
        "fgm_40_49",
        "fgm_50p",
        "xpa",
        "xpm",
      ],
    );
    assert.deepEqual(
      getStatColumns("DEF").map((column) => column.key),
      [
        "fantasy_pts",
        "adp",
        "sack",
        "tkl_loss",
        "int",
        "ff",
        "fum_rec",
        "def_td",
        "st_td",
        "def_kr_td",
        "pts_allow",
      ],
    );
    assert.deepEqual(
      getStatColumns("CB").map((column) => column.key),
      getStatColumns("S").map((column) => column.key),
    );
    assert.deepEqual(
      getStatColumns("CB").map((column) => column.key),
      [
        "fantasy_pts",
        "adp",
        "int",
        "tkl",
        "tkl_solo",
        "tkl_ast",
        "tkl_loss",
        "sack",
        "ff",
        "fum_rec",
        "def_td",
      ],
    );
    assert.deepEqual(
      getStatColumns("DE").map((column) => column.key),
      getStatColumns("LB").map((column) => column.key),
    );
    assert.deepEqual(
      getStatColumns("DT").map((column) => column.key),
      [
        "fantasy_pts",
        "adp",
        "tkl",
        "tkl_solo",
        "tkl_ast",
        "tkl_loss",
        "sack",
        "ff",
        "fum_rec",
        "def_td",
        "int",
      ],
    );
  });
});
