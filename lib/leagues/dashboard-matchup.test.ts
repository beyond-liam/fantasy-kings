import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pickDashboardMatchupHighlight } from "@/lib/leagues/dashboard-matchup";

const rows = [
  {
    week: 1,
    status: "final" as const,
    homeTeamId: "me",
    awayTeamId: "opp",
    homeTeamName: "Mine",
    awayTeamName: "Theirs",
    homePts: 120,
    awayPts: 100,
  },
  {
    week: 2,
    status: "scheduled" as const,
    homeTeamId: "opp",
    awayTeamId: "me",
    homeTeamName: "Theirs",
    awayTeamName: "Mine",
    homePts: null,
    awayPts: null,
  },
];

describe("pickDashboardMatchupHighlight", () => {
  it("prefers this week's upcoming matchup over a prior final", () => {
    const highlight = pickDashboardMatchupHighlight("me", rows, 2);
    assert.deepEqual(highlight, {
      kind: "upcoming",
      week: 2,
      opponentName: "Theirs",
    });
  });

  it("uses this week's final as last result", () => {
    const highlight = pickDashboardMatchupHighlight("me", rows, 1);
    assert.deepEqual(highlight, {
      kind: "result",
      week: 1,
      opponentName: "Theirs",
      result: "W",
      ownPts: 120,
      oppPts: 100,
    });
  });

  it("falls back to the latest final when there is no current week", () => {
    const highlight = pickDashboardMatchupHighlight("me", rows.slice(0, 1), null);
    assert.equal(highlight?.kind, "result");
    if (highlight?.kind === "result") {
      assert.equal(highlight.result, "W");
    }
  });
});
