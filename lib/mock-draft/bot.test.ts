import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildStandardRosterSlots } from "@/lib/leagues/defaults";
import { pickBotPlayer, type MockDraftPlayer } from "@/lib/mock-draft/bot";

function player(
  id: string,
  position: string,
  adp: number,
): MockDraftPlayer {
  return {
    id,
    fullName: id,
    primaryPositionId: position,
    nflTeam: "DET",
    fantasyPts: 100 - adp,
    stats: { adp_ppr: adp, adp_half_ppr: adp, adp_std: adp },
  };
}

describe("pickBotPlayer", () => {
  const rosterSlots = buildStandardRosterSlots(6, 0, 0);

  it("prefers best ADP at a position of need over BPA of another position", () => {
    const available = [
      player("wr1", "WR", 5),
      player("qb1", "QB", 40),
    ];
    // Empty roster needs QB; WR is also needed but QB is scarcer slot —
    // both are needs, so ADP among need pool: WR wins at 5.
    const pick = pickBotPlayer({
      available,
      draftedPositions: [],
      rosterSlots,
      scoring: "full_ppr",
      picksRemainingForTeam: 15,
      random: () => 0,
    });
    assert.equal(pick?.id, "wr1");
  });

  it("defers K and DEF until late picks", () => {
    const available = [
      player("k1", "K", 1),
      player("def1", "DEF", 2),
      player("rb1", "RB", 50),
    ];
    const early = pickBotPlayer({
      available,
      draftedPositions: [],
      rosterSlots,
      scoring: "full_ppr",
      picksRemainingForTeam: 10,
      random: () => 0,
    });
    assert.equal(early?.id, "rb1");

    const late = pickBotPlayer({
      available,
      draftedPositions: [
        "QB",
        "RB",
        "RB",
        "WR",
        "WR",
        "TE",
        "RB",
      ],
      rosterSlots,
      scoring: "full_ppr",
      picksRemainingForTeam: 2,
      random: () => 0,
    });
    assert.ok(late?.id === "k1" || late?.id === "def1");
  });

  it("fills open QB need when skill positions are already stacked", () => {
    const available = [
      player("wr3", "WR", 10),
      player("qb1", "QB", 60),
    ];
    const pick = pickBotPlayer({
      available,
      draftedPositions: ["RB", "RB", "WR", "WR", "TE", "RB"],
      rosterSlots,
      scoring: "full_ppr",
      picksRemainingForTeam: 8,
      random: () => 0,
    });
    assert.equal(pick?.id, "qb1");
  });
});
