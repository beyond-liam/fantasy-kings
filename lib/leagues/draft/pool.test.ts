import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dynastyDraftPoolRestrictsToRookies,
  isEligibleForDraftPlayerPool,
} from "@/lib/leagues/draft/pool";
import { resolveDynastySettings } from "@/lib/leagues/dynasty-settings";

describe("dynastyDraftPoolRestrictsToRookies", () => {
  it("is false during startup", () => {
    assert.equal(
      dynastyDraftPoolRestrictsToRookies(
        resolveDynastySettings({ draftPlayerPool: "rookies" }),
      ),
      false,
    );
  });

  it("is true for later rookies-only drafts", () => {
    assert.equal(
      dynastyDraftPoolRestrictsToRookies(
        resolveDynastySettings({
          draftPlayerPool: "rookies",
          isStartupSeason: false,
        }),
      ),
      true,
    );
  });

  it("is false when the pool is all players", () => {
    assert.equal(
      dynastyDraftPoolRestrictsToRookies(
        resolveDynastySettings({
          draftPlayerPool: "all",
          isStartupSeason: false,
        }),
      ),
      false,
    );
  });
});

describe("isEligibleForDraftPlayerPool", () => {
  it("allows everyone when unrestricted", () => {
    assert.equal(isEligibleForDraftPlayerPool(4, false), true);
    assert.equal(isEligibleForDraftPlayerPool(null, false), true);
  });

  it("allows only yearsExp 0 when restricted", () => {
    assert.equal(isEligibleForDraftPlayerPool(0, true), true);
    assert.equal(isEligibleForDraftPlayerPool(1, true), false);
    assert.equal(isEligibleForDraftPlayerPool(null, true), false);
  });
});
