import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { playerWeekHasFantasyAppearance } from "@/lib/players/week-appearance";

describe("playerWeekHasFantasyAppearance", () => {
  it("returns true for real counting-stat weeks", () => {
    assert.equal(
      playerWeekHasFantasyAppearance({
        gp: 1,
        rush_att: 10,
        pts_ppr: 12.4,
      }),
      true,
    );
  });

  it("returns false for rank-only placeholder rows", () => {
    assert.equal(
      playerWeekHasFantasyAppearance({
        gms_active: 1,
        pos_rank_ppr: 55,
        pos_rank_std: 55,
        pos_rank_half_ppr: 55,
      }),
      false,
    );
  });

  it("returns true for a recorded zero-point appearance", () => {
    assert.equal(
      playerWeekHasFantasyAppearance({
        gp: 1,
        rush_att: 2,
        pts_ppr: 0,
      }),
      true,
    );
  });

  it("returns true for IDP tackle-only weeks", () => {
    assert.equal(
      playerWeekHasFantasyAppearance({
        idp_tkl_solo: 4,
        idp_tkl_ast: 2,
      }),
      true,
    );
    assert.equal(
      playerWeekHasFantasyAppearance({
        tkl_solo: 4,
        tkl_ast: 0,
      }),
      true,
    );
  });
});
