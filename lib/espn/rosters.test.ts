import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizePlayerName } from "@/lib/espn/rosters";

describe("espn roster name normalize", () => {
  it("strips suffixes and punctuation", () => {
    assert.equal(normalizePlayerName("D.K. Metcalf"), "d k metcalf");
    assert.equal(normalizePlayerName("Kenneth Murray Jr."), "kenneth murray");
    assert.equal(normalizePlayerName("Ja'Marr Chase"), "ja marr chase");
  });
});
