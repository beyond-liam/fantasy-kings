import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { diffScoringRules } from "@/lib/leagues/settings-activity";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";

const baseRule: ScoringRuleDefinition = {
  id: "pass-comp-25",
  category: "passing",
  kind: "threshold",
  points: 2,
  stat: "Passing Completions",
  threshold: 25,
  positions: ["QB"],
};

describe("diffScoringRules", () => {
  it("describes an edited rule in plain language", () => {
    const after: ScoringRuleDefinition = { ...baseRule, points: 3 };
    const changes = diffScoringRules([baseRule], [after]);
    assert.equal(changes.length, 1);
    assert.match(changes[0]!.before, /2 extra points/);
    assert.match(changes[0]!.after, /3 extra points/);
    assert.match(changes[0]!.before, /Passing Completions/);
    assert.match(changes[0]!.before, /greater than or equal to 25/);
    assert.match(changes[0]!.label, /Passing/);
  });

  it("ignores unchanged rules", () => {
    assert.deepEqual(diffScoringRules([baseRule], [baseRule]), []);
  });

  it("marks removed and added rules", () => {
    const added: ScoringRuleDefinition = {
      ...baseRule,
      id: "new-rule",
      points: 1,
      threshold: 30,
    };
    const changes = diffScoringRules([baseRule], [added]);
    assert.equal(changes.length, 2);
    assert.equal(changes[0]!.after, "Removed");
    assert.equal(changes[1]!.before, "—");
  });
});
