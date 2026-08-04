import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTeamOpportunityShare } from "@/lib/players/team-opportunity-share";

describe("buildTeamOpportunityShare", () => {
  it("builds RB carry share from rush attempts", () => {
    const share = buildTeamOpportunityShare({
      positionId: "RB",
      playerStats: { rush_att: 180 },
      teamStatsBags: [
        { rush_att: 180 },
        { rush_att: 90 },
        { rush_att: 30 },
      ],
    });

    assert.ok(share);
    assert.equal(share?.kind, "carry");
    assert.equal(share?.playerTotal, 180);
    assert.equal(share?.teamTotal, 300);
    assert.equal(share?.playerPct, 60);
  });

  it("returns null for DEF and K", () => {
    assert.equal(
      buildTeamOpportunityShare({
        positionId: "DEF",
        playerStats: { sack: 40 },
        teamStatsBags: [{ sack: 40 }],
      }),
      null,
    );
    assert.equal(
      buildTeamOpportunityShare({
        positionId: "K",
        playerStats: { fgm: 20 },
        teamStatsBags: [{ fgm: 20 }],
      }),
      null,
    );
  });

  it("returns null when team total is zero", () => {
    assert.equal(
      buildTeamOpportunityShare({
        positionId: "WR",
        playerStats: { rec_tgt: 0 },
        teamStatsBags: [{ rec_tgt: 0 }],
      }),
      null,
    );
  });
});
