import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseStatMagnitude } from "@/components/scores/game/team-stats-comparison";

describe("parseStatMagnitude", () => {
  it("parses plain numbers", () => {
    assert.equal(parseStatMagnitude("378"), 378);
    assert.equal(parseStatMagnitude("5.6"), 5.6);
  });

  it("uses the first number for completion fractions", () => {
    assert.equal(parseStatMagnitude("29/45"), 29);
  });

  it("parses possession time as seconds", () => {
    assert.equal(parseStatMagnitude("32:15"), 32 * 60 + 15);
  });

  it("uses the first number for dashed pairs", () => {
    assert.equal(parseStatMagnitude("3-17"), 3);
  });

  it("returns 0 for missing values", () => {
    assert.equal(parseStatMagnitude("—"), 0);
    assert.equal(parseStatMagnitude("--"), 0);
  });
});
