import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatOrdinalRank,
  rankPowerScore,
  rankTone,
  slotRankFromOverall,
} from "@/lib/leagues/roster-evaluation/rank";
import { buildStarterSlotSpecs } from "@/lib/leagues/roster-evaluation/slot-specs";
import {
  buildPositionStrength,
  buildPositionalLabels,
  buildPositionalRankings,
  buildStartingLineupRanks,
  overallRanksByPlayerId,
  type RankablePlayer,
  type TeamRosterForEvaluation,
} from "@/lib/leagues/roster-evaluation/starting-lineup-ranks";
import type { FilledRosterSlot } from "@/lib/leagues/roster-fill";

describe("slotRankFromOverall", () => {
  it("maps RB1 pool 1–4 and RB2 remaps overall #4 to 1st in a 4-team league", () => {
    assert.equal(slotRankFromOverall(3, 0, 4), 3);
    assert.equal(slotRankFromOverall(4, 1, 4), 1);
    assert.equal(slotRankFromOverall(5, 1, 4), 1);
    assert.equal(slotRankFromOverall(8, 1, 4), 4);
    assert.equal(slotRankFromOverall(1, 0, 4), 1);
  });

  it("clamps overall ranks outside the depth pool to worst", () => {
    assert.equal(slotRankFromOverall(6, 0, 4), 4);
  });
});

describe("rankTone", () => {
  it("uses success / slate / warning / destructive for a 4-team league", () => {
    assert.equal(rankTone(1, 4), "success");
    assert.equal(rankTone(2, 4), "neutral");
    assert.equal(rankTone(3, 4), "warning");
    assert.equal(rankTone(4, 4), "destructive");
  });
});

describe("rankPowerScore", () => {
  it("sets rank 1 to 100", () => {
    assert.equal(rankPowerScore(1, 4), 100);
    assert.equal(rankPowerScore(4, 4), 25);
  });
});

describe("formatOrdinalRank", () => {
  it("formats common ordinals", () => {
    assert.equal(formatOrdinalRank(1), "1st");
    assert.equal(formatOrdinalRank(2), "2nd");
    assert.equal(formatOrdinalRank(3), "3rd");
    assert.equal(formatOrdinalRank(4), "4th");
  });
});

describe("buildStarterSlotSpecs", () => {
  it("expands starter counts into ordinal labels", () => {
    const specs = buildStarterSlotSpecs([
      { positionId: "QB", slotCount: 1, minSlots: 1, maxSlots: 1, isStarter: true },
      { positionId: "RB", slotCount: 2, minSlots: 2, maxSlots: 2, isStarter: true },
      { positionId: "FLEX", slotCount: 1, minSlots: 1, maxSlots: 1, isStarter: true },
      { positionId: "BN", slotCount: 5, minSlots: 0, maxSlots: 5, isStarter: false },
    ]);
    assert.deepEqual(
      specs.map((s) => s.slotLabel),
      ["QB", "RB1", "RB2", "FLX"],
    );
  });
});

describe("buildStartingLineupRanks", () => {
  it("ranks flex against all flex-eligible players", () => {
    const leaguePlayers: RankablePlayer[] = [
      {
        id: "rb1",
        fullName: "Alpha RB",
        primaryPositionId: "RB",
        sleeperId: "1",
        fantasyPts: 20,
      },
      {
        id: "wr1",
        fullName: "Beta WR",
        primaryPositionId: "WR",
        sleeperId: "2",
        fantasyPts: 18,
      },
      {
        id: "te1",
        fullName: "Gamma TE",
        primaryPositionId: "TE",
        sleeperId: "3",
        fantasyPts: 10,
      },
      {
        id: "wr2",
        fullName: "Delta WR",
        primaryPositionId: "WR",
        sleeperId: "4",
        fantasyPts: 8,
      },
    ];

    const focusLineup: FilledRosterSlot[] = [
      {
        key: "lineup-FLEX-0",
        slotPositionId: "FLEX",
        player: {
          id: "wr2",
          fullName: "Delta WR",
          nflTeam: "DET",
          primaryPositionId: "WR",
          byeWeek: 5,
          injuryStatus: null,
          sleeperId: "4",
          slotPositionId: "FLEX",
        },
      },
    ];

    const ranks = overallRanksByPlayerId(
      leaguePlayers.filter((p) => ["RB", "WR", "TE"].includes(p.primaryPositionId)),
    );
    assert.equal(ranks.get("wr2"), 4);

    const slots = buildStartingLineupRanks({
      teamCount: 4,
      slotSpecs: [
        { slotLabel: "FLX", positionId: "FLEX", depthIndex: 0 },
      ],
      focusLineup,
      leaguePlayers,
    });

    assert.equal(slots[0]?.rank, 4);
    assert.equal(slots[0]?.tone, "destructive");
  });

  it("shows overall #4 RB in RB2 as 1st in a 4-team league", () => {
    const leaguePlayers: RankablePlayer[] = Array.from({ length: 8 }, (_, i) => ({
      id: `rb${i + 1}`,
      fullName: `RB ${i + 1}`,
      primaryPositionId: "RB",
      sleeperId: String(i + 1),
      fantasyPts: 20 - i,
    }));

    const focusLineup: FilledRosterSlot[] = [
      {
        key: "lineup-RB-0",
        slotPositionId: "RB",
        player: {
          id: "rb3",
          fullName: "RB 3",
          nflTeam: "ATL",
          primaryPositionId: "RB",
          byeWeek: 5,
          injuryStatus: null,
          sleeperId: "3",
          slotPositionId: "RB",
        },
      },
      {
        key: "lineup-RB-1",
        slotPositionId: "RB",
        player: {
          id: "rb4",
          fullName: "RB 4",
          nflTeam: "NYJ",
          primaryPositionId: "RB",
          byeWeek: 9,
          injuryStatus: null,
          sleeperId: "4",
          slotPositionId: "RB",
        },
      },
    ];

    const slots = buildStartingLineupRanks({
      teamCount: 4,
      slotSpecs: [
        { slotLabel: "RB1", positionId: "RB", depthIndex: 0 },
        { slotLabel: "RB2", positionId: "RB", depthIndex: 1 },
      ],
      focusLineup,
      leaguePlayers,
    });

    assert.equal(slots[0]?.rank, 3);
    assert.equal(slots[1]?.rank, 1);
    assert.equal(slots[1]?.tone, "success");
  });
});

describe("buildPositionalLabels", () => {
  it("lists unique primary positions and excludes FLEX", () => {
    const specs = buildStarterSlotSpecs([
      { positionId: "QB", slotCount: 1, minSlots: 1, maxSlots: 4, isStarter: true },
      { positionId: "RB", slotCount: 2, minSlots: 2, maxSlots: 8, isStarter: true },
      { positionId: "FLEX", slotCount: 1, minSlots: 1, maxSlots: 1, isStarter: true },
      { positionId: "K", slotCount: 1, minSlots: 1, maxSlots: 1, isStarter: true },
      { positionId: "BN", slotCount: 5, minSlots: 0, maxSlots: 5, isStarter: false },
    ]);

    assert.deepEqual(buildPositionalLabels(specs), ["QB", "RB", "K"]);
  });
});

describe("buildPositionalRankings", () => {
  it("ranks teams by average overall rank at the position", () => {
    // League QBs ranked 1..8 by fantasyPts
    const leaguePlayers: RankablePlayer[] = Array.from({ length: 8 }, (_, i) => ({
      id: `qb${i + 1}`,
      fullName: `QB ${i + 1}`,
      primaryPositionId: "QB",
      sleeperId: String(i + 1),
      fantasyPts: 30 - i,
    }));

    function team(
      teamId: string,
      qbIds: string[],
    ): TeamRosterForEvaluation {
      const players = qbIds.map((id) => {
        const row = leaguePlayers.find((player) => player.id === id)!;
        return { ...row };
      });
      return {
        teamId,
        players,
        lineup: [],
        bench: [],
        rosterPlayers: players.map((player) => ({
          id: player.id,
          fullName: player.fullName,
          nflTeam: "BUF",
          primaryPositionId: player.primaryPositionId,
          byeWeek: 7,
          injuryStatus: null,
          sleeperId: player.sleeperId,
          slotPositionId: "QB",
        })),
      };
    }

    // Focus: QB1 + QB8 → avg 4.5
    // Better: QB2 + QB3 → avg 2.5 → 1st
    // Worse: QB5 + QB6 → avg 5.5 → 3rd
    // Worst: QB4 + QB7 → avg 5.5 — tie break by teamId
    const rows = buildPositionalRankings({
      teamCount: 4,
      focusTeamId: "focus",
      positionLabels: ["QB"],
      teams: [
        team("alpha", ["qb2", "qb3"]),
        team("focus", ["qb1", "qb8"]),
        team("charlie", ["qb5", "qb6"]),
        team("delta", ["qb4", "qb7"]),
      ],
      leaguePlayers,
    });

    assert.equal(rows[0]?.label, "QB");
    // averages: alpha 2.5, focus 4.5, charlie 5.5, delta 5.5
    assert.equal(rows[0]?.rank, 2);
    assert.equal(rows[0]?.rankLabel, "2nd");
  });
});

describe("buildPositionStrength", () => {
  it("compares starter vs bench cohort ranks at a position", () => {
    const leaguePlayers: RankablePlayer[] = Array.from({ length: 8 }, (_, i) => ({
      id: `rb${i + 1}`,
      fullName: `RB ${i + 1}`,
      primaryPositionId: "RB",
      sleeperId: String(i + 1),
      fantasyPts: 20 - i,
    }));

    function slot(
      key: string,
      positionId: string,
      playerId: string,
    ): FilledRosterSlot {
      const row = leaguePlayers.find((player) => player.id === playerId)!;
      return {
        key,
        slotPositionId: positionId,
        player: {
          id: row.id,
          fullName: row.fullName,
          nflTeam: "ATL",
          primaryPositionId: "RB",
          byeWeek: 5,
          injuryStatus: null,
          sleeperId: row.sleeperId,
          slotPositionId: positionId,
        },
      };
    }

    const focus: TeamRosterForEvaluation = {
      teamId: "focus",
      players: [leaguePlayers[0]!, leaguePlayers[1]!, leaguePlayers[7]!],
      lineup: [slot("l0", "RB", "rb1"), slot("l1", "RB", "rb2")],
      bench: [slot("b0", "BN", "rb8")],
      rosterPlayers: [],
    };
    const other: TeamRosterForEvaluation = {
      teamId: "other",
      players: [leaguePlayers[2]!, leaguePlayers[3]!, leaguePlayers[4]!],
      lineup: [slot("l0", "RB", "rb3"), slot("l1", "RB", "rb4")],
      bench: [slot("b0", "BN", "rb5")],
      rosterPlayers: [],
    };

    const points = buildPositionStrength({
      teamCount: 2,
      focusTeamId: "focus",
      positions: ["RB"],
      teams: [focus, other],
      leaguePlayers,
    });

    // Focus starters avg overall (1+2)/2 = 1.5 beats other (3+4)/2 = 3.5 → rank 1
    assert.equal(points[0]?.startersRank, 1);
    assert.equal(points[0]?.starters, 100);
    assert.equal(points[0]?.hasStarters, true);
    // Focus bench overall #8 worse than other #5 → rank 2
    assert.equal(points[0]?.benchRank, 2);
    assert.equal(points[0]?.bench, 50);
    assert.equal(points[0]?.hasBench, true);
  });

  it("zeros empty bench and flags hasBench false", () => {
    const leaguePlayers: RankablePlayer[] = [
      {
        id: "k1",
        fullName: "K 1",
        primaryPositionId: "K",
        sleeperId: "1",
        fantasyPts: 10,
      },
      {
        id: "k2",
        fullName: "K 2",
        primaryPositionId: "K",
        sleeperId: "2",
        fantasyPts: 8,
      },
    ];

    function starter(playerId: string): FilledRosterSlot {
      const row = leaguePlayers.find((player) => player.id === playerId)!;
      return {
        key: "k",
        slotPositionId: "K",
        player: {
          id: row.id,
          fullName: row.fullName,
          nflTeam: "BAL",
          primaryPositionId: "K",
          byeWeek: 7,
          injuryStatus: null,
          sleeperId: row.sleeperId,
          slotPositionId: "K",
        },
      };
    }

    const points = buildPositionStrength({
      teamCount: 2,
      focusTeamId: "focus",
      positions: ["K"],
      teams: [
        {
          teamId: "focus",
          players: [leaguePlayers[0]!],
          lineup: [starter("k1")],
          bench: [],
          rosterPlayers: [],
        },
        {
          teamId: "other",
          players: [leaguePlayers[1]!],
          lineup: [starter("k2")],
          bench: [],
          rosterPlayers: [],
        },
      ],
      leaguePlayers,
    });

    assert.equal(points[0]?.hasStarters, true);
    assert.equal(points[0]?.hasBench, false);
    assert.equal(points[0]?.bench, 0);
  });
});
