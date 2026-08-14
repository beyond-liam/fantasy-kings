import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  nflverseRowToSleeperStats,
  parseCsv,
} from "@/lib/nflverse/player-week-stats";

describe("nflverse player week stats", () => {
  it("maps offense + FG distance buckets", () => {
    const bag = nflverseRowToSleeperStats({
      completions: "21",
      attempts: "34",
      passing_yards: "188",
      passing_tds: "0",
      passing_interceptions: "1",
      passing_2pt_conversions: "0",
      carries: "4",
      rushing_yards: "22",
      rushing_tds: "1",
      receptions: "0",
      targets: "0",
      receiving_yards: "0",
      receiving_tds: "0",
      fg_made: "2",
      fg_att: "2",
      fg_made_40_49: "1",
      fg_made_50_59: "1",
      fg_made_60_: "0",
      pat_made: "3",
      pat_att: "3",
      pat_missed: "0",
    });

    assert.equal(bag.pass_yd, 188);
    assert.equal(bag.pass_int, 1);
    assert.equal(bag.rush_td, 1);
    assert.equal(bag.fgm, 2);
    assert.equal(bag.fgm_40_49, 1);
    assert.equal(bag.fgm_50p, 1);
    assert.equal(bag.xpm, 3);
    assert.equal(bag.pass_cmp, 21);
  });

  it("maps IDP defense box-score lines onto shared scoring keys", () => {
    const bag = nflverseRowToSleeperStats({
      def_tackles_solo: "6",
      def_tackle_assists: "3",
      def_tackles_for_loss: "1.5",
      def_sacks: "1",
      def_fumbles_forced: "1",
      fumble_recovery_opp: "1",
      def_interceptions: "1",
      def_pass_defended: "4",
      def_qb_hits: "3",
      def_safeties: "0",
      def_tds: "1",
    });

    assert.equal(bag.tkl_solo, 6);
    assert.equal(bag.tkl_ast, 3);
    assert.equal(bag.tkl, 9);
    assert.equal(bag.tkl_loss, 1.5);
    assert.equal(bag.sack, 1);
    assert.equal(bag.ff, 1);
    assert.equal(bag.fum_rec, 1);
    assert.equal(bag.int, 1);
    assert.equal(bag.pass_def, 4);
    assert.equal(bag.qb_hit, 3);
    assert.equal(bag.safe, undefined);
    assert.equal(bag.def_td, 1);
  });

  it("parses quoted csv fields", () => {
    const rows = parseCsv(
      'player_id,player_display_name\n00-1,"A, B"\n00-2,CeeDee Lamb\n',
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0].player_display_name, "A, B");
    assert.equal(rows[1].player_id, "00-2");
  });
});
