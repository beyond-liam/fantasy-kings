import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  scoringRuleDefinitionSchema,
  scoringRulesPayloadSchema,
} from "@/lib/leagues/scoring/schema";

const validRule = {
  id: "pass-yds",
  category: "passing",
  kind: "yards_per_every",
  points: 1,
  stat: "pass_yd",
  every: 25,
  positions: ["QB"],
};

describe("scoringRuleDefinitionSchema", () => {
  it("accepts a valid rule", () => {
    const result = scoringRuleDefinitionSchema.safeParse(validRule);
    assert.equal(result.success, true);
  });

  it("rejects unknown keys", () => {
    const result = scoringRuleDefinitionSchema.safeParse({
      ...validRule,
      extraField: "not allowed",
    });
    assert.equal(result.success, false);
  });

  it("rejects Infinity points", () => {
    const result = scoringRuleDefinitionSchema.safeParse({
      ...validRule,
      points: Infinity,
    });
    assert.equal(result.success, false);
  });

  it("rejects NaN points", () => {
    const result = scoringRuleDefinitionSchema.safeParse({
      ...validRule,
      points: NaN,
    });
    assert.equal(result.success, false);
  });

  it("rejects an invalid kind", () => {
    const result = scoringRuleDefinitionSchema.safeParse({
      ...validRule,
      kind: "not_a_real_kind",
    });
    assert.equal(result.success, false);
  });

  it("rejects an invalid category", () => {
    const result = scoringRuleDefinitionSchema.safeParse({
      ...validRule,
      category: "not_a_real_category",
    });
    assert.equal(result.success, false);
  });

  it("rejects an invalid position", () => {
    const result = scoringRuleDefinitionSchema.safeParse({
      ...validRule,
      positions: ["ZZ"],
    });
    assert.equal(result.success, false);
  });
});

describe("scoringRulesPayloadSchema", () => {
  it("accepts an array of valid rules", () => {
    const result = scoringRulesPayloadSchema.safeParse([validRule]);
    assert.equal(result.success, true);
  });

  it("rejects an array with more than 200 rules", () => {
    const rules = Array.from({ length: 201 }, (_, index) => ({
      ...validRule,
      id: `${validRule.id}-${index}`,
    }));
    const result = scoringRulesPayloadSchema.safeParse(rules);
    assert.equal(result.success, false);
  });

  it("accepts exactly 200 rules", () => {
    const rules = Array.from({ length: 200 }, (_, index) => ({
      ...validRule,
      id: `${validRule.id}-${index}`,
    }));
    const result = scoringRulesPayloadSchema.safeParse(rules);
    assert.equal(result.success, true);
  });
});
