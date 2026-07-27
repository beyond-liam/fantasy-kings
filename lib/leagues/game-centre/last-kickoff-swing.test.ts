import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyLastKickoffSwing,
  countChokeAndFergieByTeam,
} from "@/lib/leagues/game-centre/last-kickoff-swing";

describe("classifyLastKickoffSwing", () => {
  it("marks choke for the leader and Fergie for the comeback winner", () => {
    const swing = classifyLastKickoffSwing({
      homeTeamId: "home",
      awayTeamId: "away",
      homePts: 100,
      awayPts: 110,
      homeStarters: [
        { kickoff: "2026-01-01T18:00:00Z", actualPts: 80 },
        { kickoff: "2026-01-02T01:20:00Z", actualPts: 20 },
      ],
      awayStarters: [
        { kickoff: "2026-01-01T18:00:00Z", actualPts: 60 },
        { kickoff: "2026-01-02T01:20:00Z", actualPts: 50 },
      ],
    });
    // Before MNF: home 80, away 60 → home led; away won → home choke / away Fergie
    assert.deepEqual(swing, {
      chokeTeamId: "home",
      fergieTeamId: "away",
    });
  });

  it("returns null with a single kickoff wave", () => {
    const swing = classifyLastKickoffSwing({
      homeTeamId: "home",
      awayTeamId: "away",
      homePts: 120,
      awayPts: 100,
      homeStarters: [{ kickoff: "2026-01-01T18:00:00Z", actualPts: 120 }],
      awayStarters: [{ kickoff: "2026-01-01T18:00:00Z", actualPts: 100 }],
    });
    assert.equal(swing, null);
  });

  it("returns null when tied entering the last wave", () => {
    const swing = classifyLastKickoffSwing({
      homeTeamId: "home",
      awayTeamId: "away",
      homePts: 110,
      awayPts: 100,
      homeStarters: [
        { kickoff: "2026-01-01T18:00:00Z", actualPts: 70 },
        { kickoff: "2026-01-02T01:20:00Z", actualPts: 40 },
      ],
      awayStarters: [
        { kickoff: "2026-01-01T18:00:00Z", actualPts: 70 },
        { kickoff: "2026-01-02T01:20:00Z", actualPts: 30 },
      ],
    });
    assert.equal(swing, null);
  });

  it("counts choke and Fergie totals", () => {
    const { choke, fergie } = countChokeAndFergieByTeam([
      { chokeTeamId: "a", fergieTeamId: "b" },
      { chokeTeamId: "a", fergieTeamId: "c" },
      { chokeTeamId: "b", fergieTeamId: "c" },
    ]);
    assert.equal(choke.get("a"), 2);
    assert.equal(fergie.get("c"), 2);
    assert.equal(fergie.get("b"), 1);
  });
});
