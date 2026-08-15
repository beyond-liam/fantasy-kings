import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pickWaiverTips } from "@/lib/leagues/game-centre/waivers";
import type { FilledRosterSlot, TeamRosterPlayer } from "@/lib/leagues/roster-fill";
import type { RankedPlayerRow } from "@/lib/queries/players";
import type { LeaguePlayerOwnershipMap } from "@/lib/queries/roster";

function starter(
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

function slot(
  slotPositionId: string,
  player: TeamRosterPlayer | null,
  index = 0,
): FilledRosterSlot {
  return {
    key: `lineup-${slotPositionId}-${index}`,
    slotPositionId,
    player,
  };
}

function fa(
  id: string,
  primaryPositionId: string,
  fantasyPts: number,
  nflTeam = "KC",
): RankedPlayerRow {
  return {
    id,
    fullName: id,
    nflTeam,
    primaryPositionId,
    sleeperId: null,
    yearsExp: null,
    byeWeek: null,
    injuryStatus: null,
    rookieYear: null,
    stats: {},
    ptsPpr: null,
    ptsStd: null,
    fantasyPts,
    positionRank: null,
  };
}

const emptyOwnership: LeaguePlayerOwnershipMap = new Map();

describe("pickWaiverTips", () => {
  it("ranks pickups by the largest projection upgrade", () => {
    const lineup = [
      slot("QB", starter({ id: "qb", fullName: "QB", primaryPositionId: "QB" })),
      slot("RB", starter({ id: "rb", fullName: "RB", primaryPositionId: "RB" })),
      slot("WR", starter({ id: "wr", fullName: "WR", primaryPositionId: "WR" })),
      slot("K", starter({ id: "k", fullName: "K", primaryPositionId: "K" })),
    ];
    const tips = pickWaiverTips({
      projections: [
        fa("fa-qb", "QB", 20),
        fa("fa-rb", "RB", 18),
        fa("fa-wr", "WR", 22),
        fa("fa-k", "K", 20),
      ],
      ownership: emptyOwnership,
      lineup,
      projectedById: new Map([
        ["qb", 15],
        ["rb", 10],
        ["wr", 12],
        ["k", 3],
      ]),
      startedTeams: new Set(),
      limit: 3,
    });

    assert.deepEqual(
      tips.map((tip) => tip.playerId),
      ["fa-k", "fa-wr", "fa-rb"],
    );
    assert.equal(tips[0]?.upgradeOver, 17);
    assert.equal(tips[1]?.upgradeOver, 10);
    assert.equal(tips[2]?.upgradeOver, 8);
  });

  it("skips positions whose starter has already played", () => {
    const lineup = [
      slot(
        "QB",
        starter({
          id: "qb",
          fullName: "QB",
          primaryPositionId: "QB",
          nflTeam: "KC",
        }),
      ),
      slot("K", starter({ id: "k", fullName: "K", primaryPositionId: "K" })),
    ];
    const tips = pickWaiverTips({
      projections: [fa("fa-qb", "QB", 30), fa("fa-k", "K", 12, "MIN")],
      ownership: emptyOwnership,
      lineup,
      projectedById: new Map([
        ["qb", 10],
        ["k", 3],
      ]),
      startedTeams: new Set(["KC"]),
      limit: 3,
    });

    assert.deepEqual(
      tips.map((tip) => tip.playerId),
      ["fa-k"],
    );
  });

  it("does not suggest FAs worse than the current starter", () => {
    const lineup = [
      slot("QB", starter({ id: "qb", fullName: "QB", primaryPositionId: "QB" })),
    ];
    const tips = pickWaiverTips({
      projections: [fa("fa-qb", "QB", 12)],
      ownership: emptyOwnership,
      lineup,
      projectedById: new Map([["qb", 20]]),
      startedTeams: new Set(),
    });

    assert.deepEqual(tips, []);
  });

  it("skips FAs whose NFL game has already started", () => {
    const lineup = [
      slot("K", starter({ id: "k", fullName: "K", primaryPositionId: "K" })),
    ];
    const tips = pickWaiverTips({
      projections: [fa("fa-k", "K", 20, "DAL")],
      ownership: emptyOwnership,
      lineup,
      projectedById: new Map([["k", 3]]),
      startedTeams: new Set(["DAL"]),
    });

    assert.deepEqual(tips, []);
  });
});
