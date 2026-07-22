import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeOptimumLineup } from "@/lib/leagues/game-centre/optimum";
import type { TeamRosterPlayer } from "@/lib/leagues/roster-fill";

function player(
  partial: Pick<TeamRosterPlayer, "id" | "fullName" | "primaryPositionId"> &
    Partial<TeamRosterPlayer>,
): TeamRosterPlayer {
  return {
    nflTeam: "BUF",
    injuryStatus: null,
    sleeperId: null,
    slotPositionId: partial.slotPositionId ?? partial.primaryPositionId,
    ...partial,
  } as TeamRosterPlayer;
}

describe("computeOptimumLineup", () => {
  it("never suggests emptying a starter slot", () => {
    const strange = player({
      id: "strange",
      fullName: "Brenton Strange",
      primaryPositionId: "TE",
      slotPositionId: "TE",
    });
    const chase = player({
      id: "chase",
      fullName: "Ja'Marr Chase",
      primaryPositionId: "WR",
      slotPositionId: "WR",
    });
    const lineup = [
      { key: "lineup-WR-0", slotPositionId: "WR", player: chase },
      { key: "lineup-TE-0", slotPositionId: "TE", player: strange },
      { key: "lineup-FLEX-0", slotPositionId: "FLEX", player: null },
    ];
    const result = computeOptimumLineup({
      lineup,
      rosterPlayers: [chase, strange],
      projectedById: new Map([
        ["chase", 19.5],
        ["strange", 8.4],
      ]),
      startedTeams: new Set(),
    });

    const te = result.slots.find((slot) => slot.slotPositionId === "TE");
    assert.equal(te?.suggestedPlayerId, "strange");
    assert.ok(result.optimumProjectedTotal >= result.currentProjectedTotal);
  });

  it("promotes a higher-projected bench player into an eligible slot", () => {
    const strange = player({
      id: "strange",
      fullName: "Brenton Strange",
      primaryPositionId: "TE",
      slotPositionId: "TE",
    });
    const kincaid = player({
      id: "kincaid",
      fullName: "Dalton Kincaid",
      primaryPositionId: "TE",
      slotPositionId: "BN",
    });
    const result = computeOptimumLineup({
      lineup: [{ key: "lineup-TE-0", slotPositionId: "TE", player: strange }],
      rosterPlayers: [strange, kincaid],
      projectedById: new Map([
        ["strange", 8.4],
        ["kincaid", 9.3],
      ]),
      startedTeams: new Set(),
    });

    assert.equal(result.slots[0]?.suggestedPlayerId, "kincaid");
    assert.equal(result.canApply, true);
    assert.ok(result.optimumProjectedTotal > result.currentProjectedTotal);
  });

  it("does not reshuffle equal starters across duplicate slots", () => {
    const irving = player({
      id: "irving",
      fullName: "Bucky Irving",
      primaryPositionId: "RB",
      slotPositionId: "RB",
    });
    const gibbs = player({
      id: "gibbs",
      fullName: "Jahmyr Gibbs",
      primaryPositionId: "RB",
      slotPositionId: "RB",
    });
    const result = computeOptimumLineup({
      lineup: [
        { key: "lineup-RB-0", slotPositionId: "RB", player: irving },
        { key: "lineup-RB-1", slotPositionId: "RB", player: gibbs },
      ],
      rosterPlayers: [irving, gibbs],
      projectedById: new Map([
        ["irving", 11.8],
        ["gibbs", 20.4],
      ]),
      startedTeams: new Set(),
    });

    assert.equal(result.slots[0]?.suggestedPlayerId, "irving");
    assert.equal(result.slots[1]?.suggestedPlayerId, "gibbs");
    assert.equal(result.canApply, false);
  });
});
