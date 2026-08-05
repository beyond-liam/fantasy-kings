import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeDraftGrades,
  draftGradeImageSrc,
  formatDraftPickLabel,
  letterFromLeagueRank,
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

  it("assigns spread letters by rank", () => {
    assert.equal(letterFromLeagueRank(1, 12), "A+");
    assert.equal(letterFromLeagueRank(12, 12), "F");
  });

  it("ranks stronger projected teams higher", () => {
    const results = computeDraftGrades({
      teams: [{ teamId: "strong" }, { teamId: "weak" }],
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
          overall: 3,
          fantasyPts: 350,
          adp: 8,
        }),
        pick({
          teamId: "weak",
          playerId: "c",
          overall: 2,
          fantasyPts: 120,
          adp: 2,
        }),
        pick({
          teamId: "weak",
          playerId: "d",
          overall: 4,
          fantasyPts: 90,
          adp: 4,
        }),
      ],
      starterSlots: 2,
      regularSeasonWeeks: 14,
      playoffTeamCount: 4,
    });

    assert.equal(results[0]?.teamId, "strong");
    assert.equal(results[0]?.leagueRank, 1);
    assert.ok(["A+", "A", "B+"].includes(results[0]!.letter));
    assert.equal(results[1]?.teamId, "weak");
    assert.ok(results[0]!.projectedWins >= results[1]!.projectedWins);
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
});
