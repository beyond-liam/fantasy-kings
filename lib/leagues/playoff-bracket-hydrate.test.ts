import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPlayoffBracket } from "@/lib/leagues/playoff-bracket";
import { hydratePlayoffBracket } from "@/lib/leagues/playoff-bracket-hydrate";

function seedTeams(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    seed: index + 1,
    teamId: `t${index + 1}`,
    teamPublicId: `p${index + 1}`,
    teamName: `Team ${index + 1}`,
    logoUrl: null,
  }));
}

describe("hydratePlayoffBracket championship", () => {
  it("crowns a single-week champion and keeps TBD until final", () => {
    const bracket = buildPlayoffBracket({
      teams: seedTeams(4),
      playoffTeamCount: 4,
      championshipWeek: 17,
    });
    assert.ok(bracket);

    const pending = hydratePlayoffBracket(
      bracket,
      [
        {
          week: 16,
          homeTeamId: "t1",
          awayTeamId: "t4",
          homePts: 120,
          awayPts: 100,
          status: "final",
        },
        {
          week: 16,
          homeTeamId: "t2",
          awayTeamId: "t3",
          homePts: 110,
          awayPts: 90,
          status: "final",
        },
        {
          week: 17,
          homeTeamId: "t1",
          awayTeamId: "t2",
          homePts: 105,
          awayPts: 100,
          status: "in_progress",
        },
      ],
      seedTeams(4),
    );
    assert.equal(pending.champion ?? null, null);

    const crowned = hydratePlayoffBracket(
      bracket,
      [
        {
          week: 16,
          homeTeamId: "t1",
          awayTeamId: "t4",
          homePts: 120,
          awayPts: 100,
          status: "final",
        },
        {
          week: 16,
          homeTeamId: "t2",
          awayTeamId: "t3",
          homePts: 110,
          awayPts: 90,
          status: "final",
        },
        {
          week: 17,
          homeTeamId: "t1",
          awayTeamId: "t2",
          homePts: 105,
          awayPts: 100,
          status: "final",
        },
      ],
      seedTeams(4),
    );
    assert.equal(crowned.champion?.teamId, "t1");
    assert.equal(crowned.champion?.seriesPts, 105);
  });

  it("sums two-week series and crowns the combined winner", () => {
    const bracket = buildPlayoffBracket({
      teams: seedTeams(4),
      playoffTeamCount: 4,
      championshipWeek: 17,
      twoWeekChampionship: true,
    });
    assert.ok(bracket);

    const hydrated = hydratePlayoffBracket(
      bracket,
      [
        {
          week: 15,
          homeTeamId: "t1",
          awayTeamId: "t4",
          homePts: 120,
          awayPts: 100,
          status: "final",
        },
        {
          week: 15,
          homeTeamId: "t2",
          awayTeamId: "t3",
          homePts: 110,
          awayPts: 90,
          status: "final",
        },
        {
          week: 16,
          homeTeamId: "t1",
          awayTeamId: "t2",
          homePts: 100,
          awayPts: 110,
          status: "final",
        },
        {
          week: 17,
          homeTeamId: "t1",
          awayTeamId: "t2",
          homePts: 120,
          awayPts: 100,
          status: "final",
        },
      ],
      seedTeams(4),
    );

    // 220 vs 210
    assert.equal(hydrated.champion?.teamId, "t1");
    assert.equal(hydrated.champion?.seriesPts, 220);

    const g1 = hydrated.rounds.find((round) => round.id === "championship");
    const g2 = hydrated.rounds.find((round) => round.id === "championship-g2");
    assert.ok(g1 && g2);
    const g1Top = g1.matchups[0]?.top;
    const g2Top = g2.matchups[0]?.top;
    assert.ok(g1Top && g1Top.type === "team");
    assert.ok(g2Top && g2Top.type === "team");
    assert.equal(g1Top.team.seriesScore, 220);
    assert.equal(g2Top.team.seriesScore, 220);
    assert.equal(g2Top.team.teamId, "t1");
    assert.equal(g2.matchups[0]?.bottom.type === "team"
      ? g2.matchups[0].bottom.team.teamId
      : null, "t2");
  });
});
