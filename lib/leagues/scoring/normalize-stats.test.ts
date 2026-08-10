import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculatePlayerPoints } from "@/lib/leagues/scoring/calculate";
import { getDefaultScoringRuleDefinitions } from "@/lib/leagues/scoring/defaults";
import { normalizePlayerStats } from "@/lib/leagues/scoring/normalize-stats";

describe("normalizePlayerStats IDP aliases", () => {
  it("maps idp_* projection keys onto shared defense keys", () => {
    const normalized = normalizePlayerStats({
      idp_tkl_solo: 35,
      idp_tkl_ast: 17,
      idp_sack: 13,
      idp_ff: 3,
      idp_fum_rec: 2,
      idp_int: 1,
    });

    assert.equal(normalized.tkl_solo, 35);
    assert.equal(normalized.tkl_ast, 17);
    assert.equal(normalized.tkl, 52);
    assert.equal(normalized.sack, 13);
    assert.equal(normalized.ff, 3);
    assert.equal(normalized.fum_rec, 2);
    assert.equal(normalized.int, 1);
  });

  it("does not overwrite existing non-idp defense keys", () => {
    const normalized = normalizePlayerStats({
      sack: 2,
      idp_sack: 13,
    });
    assert.equal(normalized.sack, 2);
  });

  it("scores IDP rules from aliased projection stats", () => {
    const rules = getDefaultScoringRuleDefinitions("full_ppr");
    const stats = normalizePlayerStats({
      idp_tkl_solo: 35,
      idp_tkl_ast: 17,
      idp_sack: 13,
      idp_ff: 3,
      idp_fum_rec: 2,
      idp_int: 1,
    });
    // 35*1 + 17*0.5 + 13*2 + 3*2 + 2*1 + 1*2 = 35+8.5+26+6+2+2 = 79.5
    assert.equal(calculatePlayerPoints(stats, "DE", rules), 79.5);
  });

  it("fills omitted counting stats with 0 for real appearances", () => {
    const normalized = normalizePlayerStats({
      idp_tkl_solo: 5,
      idp_tkl_ast: 1,
    });
    assert.equal(normalized.tkl_solo, 5);
    assert.equal(normalized.tkl_ast, 1);
    assert.equal(normalized.tkl, 6);
    assert.equal(normalized.int, 0);
    assert.equal(normalized.sack, 0);
    assert.equal(normalized.tkl_loss, 0);
    assert.equal(normalized.ff, 0);
  });

  it("does not invent zeros for rank-only placeholder rows", () => {
    const normalized = normalizePlayerStats({
      gms_active: 1,
      pos_rank_ppr: 55,
      pos_rank_std: 55,
    });
    assert.equal(normalized.int, undefined);
    assert.equal(normalized.rec, undefined);
    assert.equal(normalized.tkl, undefined);
  });

  it("keeps explicit zeros", () => {
    const normalized = normalizePlayerStats({
      gp: 1,
      rush_att: 0,
      rush_yd: 0,
      rec: 0,
    });
    assert.equal(normalized.rush_att, 0);
    assert.equal(normalized.rush_yd, 0);
    assert.equal(normalized.rec, 0);
    assert.equal(normalized.rec_yd, 0);
  });
});
