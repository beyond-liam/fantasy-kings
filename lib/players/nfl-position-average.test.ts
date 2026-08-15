import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeNflPositionAverage } from "@/lib/players/nfl-position-average";

describe("computeNflPositionAverage", () => {
  it("volume-weights QB completion % across player-weeks", () => {
    const avg = computeNflPositionAverage("QB", [
      { pass_cmp: 20, pass_att: 40 },
      { pass_cmp: 30, pass_att: 40 },
      { pass_cmp: 0, pass_att: 0 },
    ]);
    assert.equal(avg, 62.5);
  });

  it("volume-weights WR catch rate and ignores empty bags", () => {
    const avg = computeNflPositionAverage("WR", [
      { rec: 6, rec_tgt: 10 },
      { rec: 2, rec_tgt: 10 },
      null,
      {},
    ]);
    assert.equal(avg, 40);
  });

  it("computes TE catch rate the same way as WR", () => {
    const avg = computeNflPositionAverage("TE", [
      { rec: 7, rec_tgt: 10 },
    ]);
    assert.equal(avg, 70);
  });

  it("volume-weights RB yards per carry", () => {
    const avg = computeNflPositionAverage("RB", [
      { rush_yd: 80, rush_att: 20 },
      { rush_yd: 40, rush_att: 10 },
    ]);
    assert.equal(avg, 4);
  });

  it("volume-weights IDP solo tackle %", () => {
    const avg = computeNflPositionAverage("LB", [
      { tkl_solo: 8, tkl_ast: 2 },
      { tkl_solo: 2, tkl_ast: 8 },
    ]);
    assert.equal(avg, 50);
  });

  it("averages kicker FG+XP makes per player-week", () => {
    const avg = computeNflPositionAverage("K", [
      { fgm: 2, xpm: 1, fga: 2, xpa: 1 },
      { fgm: 1, xpm: 2, fga: 1, xpa: 2 },
      { fgm: 0, xpm: 0, fga: 0, xpa: 0 },
    ]);
    assert.equal(avg, 3);
  });

  it("averages DEF points allowed per team-week", () => {
    const avg = computeNflPositionAverage("DEF", [
      { pts_allow: 10 },
      { pts_allow: 20 },
      { pts_allow: 30 },
    ]);
    assert.equal(avg, 20);
  });

  it("returns null when there is no usable volume", () => {
    assert.equal(computeNflPositionAverage("QB", []), null);
    assert.equal(
      computeNflPositionAverage("WR", [{ rec: 0, rec_tgt: 0 }]),
      null,
    );
  });
});
