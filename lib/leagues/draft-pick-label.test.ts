import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dynastyPickLabel,
  formatResolvedPickSlot,
  formatUnresolvedPickLabel,
  overallFromDraftSlot,
  uniqueDraftPickYears,
} from "@/lib/leagues/draft-pick-label";

describe("formatUnresolvedPickLabel", () => {
  it("omits via for original-owner picks", () => {
    assert.equal(
      formatUnresolvedPickLabel({ draftYear: 2028, round: 1 }),
      "2028 1st",
    );
  });

  it("adds via when the pick was acquired", () => {
    assert.equal(
      formatUnresolvedPickLabel({
        draftYear: 2028,
        round: 1,
        viaTeamName: "Lions",
      }),
      "2028 1st (via Lions)",
    );
  });
});

describe("formatResolvedPickSlot", () => {
  it("pads the slot to two digits", () => {
    assert.equal(formatResolvedPickSlot(1, 4), "1.04");
    assert.equal(formatResolvedPickSlot(2, 12), "2.12");
  });
});

describe("overallFromDraftSlot", () => {
  it("uses draft slot in linear and odd snake rounds", () => {
    assert.equal(
      overallFromDraftSlot({
        round: 1,
        draftSlot: 4,
        teamCount: 12,
        style: "linear",
      }),
      4,
    );
    assert.equal(
      overallFromDraftSlot({
        round: 2,
        draftSlot: 4,
        teamCount: 12,
        style: "linear",
      }),
      16,
    );
  });

  it("reverses even snake rounds", () => {
    assert.equal(
      overallFromDraftSlot({
        round: 2,
        draftSlot: 1,
        teamCount: 12,
        style: "snake",
      }),
      24,
    );
  });
});

describe("dynastyPickLabel", () => {
  const base = {
    draftYear: 2027,
    round: 1,
    slot: null as number | null,
    originalTeamName: "Lions",
    isOriginalOwner: true,
    currentSeasonYear: 2027,
    originalTeamDraftSlot: 4,
  };

  it("resolves the current draft year from the original team's slot", () => {
    const label = dynastyPickLabel(base);
    assert.equal(label.resolved, true);
    assert.equal(label.primary, "1.04");
    assert.equal(label.secondary, "2027 1st");
  });

  it("stays unresolved for later years", () => {
    const label = dynastyPickLabel({
      ...base,
      draftYear: 2028,
      originalTeamDraftSlot: 4,
    });
    assert.equal(label.resolved, false);
    assert.equal(label.primary, "2028 1st");
    assert.equal(label.secondary, null);
  });

  it("uses stored slot even for future years", () => {
    const label = dynastyPickLabel({
      ...base,
      draftYear: 2028,
      slot: 9,
    });
    assert.equal(label.primary, "1.09");
    assert.equal(label.resolved, true);
  });

  it("adds via when the owner is not the original team", () => {
    const label = dynastyPickLabel({
      ...base,
      draftYear: 2028,
      isOriginalOwner: false,
      originalTeamDraftSlot: null,
    });
    assert.equal(label.primary, "2028 1st (via Lions)");
  });
});

describe("uniqueDraftPickYears", () => {
  it("sorts unique years", () => {
    assert.deepEqual(uniqueDraftPickYears([2029, 2027, 2027, 2028]), [
      2027, 2028, 2029,
    ]);
  });
});
