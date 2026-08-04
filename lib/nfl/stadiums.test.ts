import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getGameSiteRoof,
  getGameSiteTeam,
  getNflStadiumRoof,
} from "@/lib/nfl/stadiums";

describe("getNflStadiumRoof", () => {
  it("classifies dome and outdoor homes", () => {
    assert.equal(getNflStadiumRoof("DET"), "indoor");
    assert.equal(getNflStadiumRoof("NO"), "indoor");
    assert.equal(getNflStadiumRoof("GB"), "outdoor");
    assert.equal(getNflStadiumRoof("KC"), "outdoor");
  });

  it("treats retractable and skylight roofs as indoor", () => {
    assert.equal(getNflStadiumRoof("DAL"), "indoor");
    assert.equal(getNflStadiumRoof("ARI"), "indoor");
    assert.equal(getNflStadiumRoof("LAR"), "indoor");
    assert.equal(getNflStadiumRoof("LAC"), "indoor");
  });
});

describe("getGameSiteRoof", () => {
  it("uses the player's stadium at home and the opponent's on the road", () => {
    assert.equal(
      getGameSiteTeam({
        playerTeam: "ATL",
        venue: "home",
        opponentAbbrev: "SEA",
      }),
      "ATL",
    );
    assert.equal(
      getGameSiteRoof({
        playerTeam: "ATL",
        venue: "home",
        opponentAbbrev: "SEA",
      }),
      "indoor",
    );
    assert.equal(
      getGameSiteRoof({
        playerTeam: "ATL",
        venue: "away",
        opponentAbbrev: "SEA",
      }),
      "outdoor",
    );
  });
});
