import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bestAndWorstValue,
  computeDraftGrades,
  draftGradeImageSrc,
  formatDraftPickLabel,
  letterFromPowerScore,
  teamProjectedStrength,
  type DraftGradePickInput,
} from "@/lib/leagues/draft/grades";

function pick(
  overrides: Partial<DraftGradePickInput> &
    Pick<DraftGradePickInput, "teamId" | "playerId" | "overall">,
): DraftGradePickInput {
  return {
    round: 1,
    pickInRound: 1,
    fantasyPts: 200,
    adp: overrides.overall,
    primaryPositionId: "RB",
    ...overrides,
  };
}

describe("draft grades", () => {
  it("maps letter assets", () => {
    assert.equal(draftGradeImageSrc("A+"), "/draft-grade-a-plus.png");
    assert.equal(draftGradeImageSrc("F"), "/draft-grade-f.png");
  });

  it("formats pick labels", () => {
    assert.equal(formatDraftPickLabel(1, 2), "1.02");
    assert.equal(formatDraftPickLabel(4, 10), "4.10");
  });

  it("weights starters over bench", () => {
    const picks = [
      pick({ teamId: "t1", playerId: "p1", overall: 1, fantasyPts: 300 }),
      pick({ teamId: "t1", playerId: "p2", overall: 24, fantasyPts: 100 }),
    ];
    const withStarterBias = teamProjectedStrength(picks, 1);
    assert.equal(withStarterBias, 300 + 100 * 0.35);
  });

  it("assigns letters from absolute power score", () => {
    assert.equal(letterFromPowerScore(100), "A+");
    assert.equal(letterFromPowerScore(95), "A");
    assert.equal(letterFromPowerScore(90), "B+");
    assert.equal(letterFromPowerScore(40), "F");
  });

  it("ranks stronger projected teams higher with clustered scores", () => {
    const results = computeDraftGrades({
      teams: [{ teamId: "strong" }, { teamId: "close" }, { teamId: "weak" }],
      picks: [
        pick({
          teamId: "strong",
          playerId: "a",
          overall: 1,
          fantasyPts: 400,
          adp: 5,
        }),
        pick({
          teamId: "strong",
          playerId: "b",
          overall: 4,
          fantasyPts: 350,
          adp: 8,
        }),
        pick({
          teamId: "close",
          playerId: "c",
          overall: 2,
          fantasyPts: 390,
          adp: 6,
        }),
        pick({
          teamId: "close",
          playerId: "d",
          overall: 5,
          fantasyPts: 340,
          adp: 9,
        }),
        pick({
          teamId: "weak",
          playerId: "e",
          overall: 3,
          fantasyPts: 120,
          adp: 2,
        }),
        pick({
          teamId: "weak",
          playerId: "f",
          overall: 6,
          fantasyPts: 90,
          adp: 4,
        }),
      ],
      starterSlots: 2,
      regularSeasonWeeks: 14,
      playoffTeamCount: 4,
    });

    assert.equal(results[0]?.teamId, "strong");
    assert.equal(results[0]?.score, 100);
    assert.equal(results[0]?.letter, "A+");
    assert.equal(results[1]?.teamId, "close");
    assert.ok((results[1]?.score ?? 0) >= 90);
    assert.ok(["A+", "A", "B+"].includes(results[1]!.letter));
    assert.equal(results[2]?.teamId, "weak");
    assert.ok((results[2]?.score ?? 0) < (results[1]?.score ?? 0));
  });

  it("picks best and worst ADP values", () => {
    const [result] = computeDraftGrades({
      teams: [{ teamId: "t1" }],
      picks: [
        pick({
          teamId: "t1",
          playerId: "steal",
          overall: 20,
          adp: 5,
          fantasyPts: 200,
        }),
        pick({
          teamId: "t1",
          playerId: "reach",
          overall: 5,
          adp: 25,
          fantasyPts: 180,
        }),
      ],
      starterSlots: 2,
      regularSeasonWeeks: 14,
      playoffTeamCount: 4,
    });

    assert.equal(result?.bestValue?.playerId, "steal");
    assert.equal(result?.worstValue?.playerId, "reach");
  });

  it("ignores late K/DEF for worst value unless taken by round 8", () => {
    const lateK = bestAndWorstValue([
      pick({
        teamId: "t1",
        playerId: "skill-reach",
        overall: 10,
        adp: 30,
        round: 2,
        primaryPositionId: "WR",
      }),
      pick({
        teamId: "t1",
        playerId: "late-k",
        overall: 120,
        adp: 140,
        round: 12,
        primaryPositionId: "K",
        fantasyPts: 80,
      }),
    ]);
    assert.equal(lateK.worst?.playerId, "skill-reach");

    const earlyDef = bestAndWorstValue([
      pick({
        teamId: "t1",
        playerId: "mild-reach",
        overall: 20,
        adp: 25,
        round: 3,
        primaryPositionId: "RB",
      }),
      pick({
        teamId: "t1",
        playerId: "early-def",
        overall: 40,
        adp: 90,
        round: 5,
        primaryPositionId: "DEF",
        fantasyPts: 90,
      }),
    ]);
    assert.equal(earlyDef.worst?.playerId, "early-def");
  });
});
