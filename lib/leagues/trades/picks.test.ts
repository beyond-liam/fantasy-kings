import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  tradeSideHasOffer,
  validatePickOwnership,
} from "@/lib/leagues/trades/picks";

describe("validatePickOwnership", () => {
  const assets = [
    { id: "p1", ownerTeamId: "a", leagueId: "lg" },
    { id: "p2", ownerTeamId: "b", leagueId: "lg" },
  ];

  it("allows empty pick legs", () => {
    assert.equal(
      validatePickOwnership({
        proposingTeamId: "a",
        receivingTeamId: "b",
        proposingPickIds: [],
        receivingPickIds: [],
        assets: [],
        leagueId: "lg",
        isDynasty: true,
      }),
      null,
    );
  });

  it("rejects pick legs in redraft", () => {
    const error = validatePickOwnership({
      proposingTeamId: "a",
      receivingTeamId: "b",
      proposingPickIds: ["p1"],
      receivingPickIds: [],
      assets,
      leagueId: "lg",
      isDynasty: false,
    });
    assert.equal(error, "Draft picks can only be traded in dynasty leagues.");
  });

  it("rejects a pick the offering team does not own", () => {
    const error = validatePickOwnership({
      proposingTeamId: "a",
      receivingTeamId: "b",
      proposingPickIds: ["p2"],
      receivingPickIds: [],
      assets,
      leagueId: "lg",
      isDynasty: true,
    });
    assert.match(error ?? "", /no longer owned/);
  });

  it("accepts each side offering its own pick", () => {
    assert.equal(
      validatePickOwnership({
        proposingTeamId: "a",
        receivingTeamId: "b",
        proposingPickIds: ["p1"],
        receivingPickIds: ["p2"],
        assets,
        leagueId: "lg",
        isDynasty: true,
      }),
      null,
    );
  });
});

describe("tradeSideHasOffer", () => {
  it("is true for picks without players", () => {
    assert.equal(
      tradeSideHasOffer({ playerIds: [], pickIds: ["p1"] }),
      true,
    );
  });
});
