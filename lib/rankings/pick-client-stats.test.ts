import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clientStatAllowlist,
  pickClientStats,
} from "./pick-client-stats";

describe("pickClientStats", () => {
  it("keeps column and rank keys and drops unused sleeper fields", () => {
    const picked = pickClientStats({
      pass_yd: 320.5,
      pos_rank_ppr: 4,
      adp_ppr: 12.3,
      some_unused_sleeper_field: 99,
      adp: 12.3,
    });

    assert.equal(picked.pass_yd, 320.5);
    assert.equal(picked.pos_rank_ppr, 4);
    assert.equal(picked.adp_ppr, 12.3);
    assert.equal(picked.adp, 12.3);
    assert.equal(picked.some_unused_sleeper_field, undefined);
  });

  it("builds a finite allowlist that includes adp helpers", () => {
    const allowlist = clientStatAllowlist();
    assert.ok(allowlist.size > 0);
    assert.ok(allowlist.size < 200);
    assert.equal(allowlist.has("adp"), true);
    assert.equal(allowlist.has("adp_ppr"), true);
  });
});
