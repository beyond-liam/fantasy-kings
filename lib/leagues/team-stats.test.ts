import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { groupRosterPlayersForStats } from "@/lib/leagues/team-stats";
import type { RankedPlayerRow } from "@/lib/queries/players";

function player(
  overrides: Partial<RankedPlayerRow> &
    Pick<RankedPlayerRow, "id" | "fullName" | "primaryPositionId">,
): RankedPlayerRow {
  return {
    sleeperId: null,
    nflTeam: null,
    byeWeek: null,
    injuryStatus: null,
    yearsExp: null,
    rookieYear: null,
    fantasyPts: 0,
    positionRank: null,
    ptsPpr: null,
    ptsStd: null,
    stats: {},
    opponent: null,
    ...overrides,
  };
}

describe("groupRosterPlayersForStats", () => {
  it("groups IDP into DB / DL / LB tables and omits empty DEF", () => {
    const sections = groupRosterPlayersForStats([
      player({ id: "1", fullName: "QB", primaryPositionId: "QB", fantasyPts: 20 }),
      player({ id: "2", fullName: "CB", primaryPositionId: "CB", fantasyPts: 10 }),
      player({ id: "3", fullName: "S", primaryPositionId: "S", fantasyPts: 12 }),
      player({ id: "4", fullName: "DT", primaryPositionId: "DT", fantasyPts: 8 }),
      player({ id: "5", fullName: "DE", primaryPositionId: "DE", fantasyPts: 9 }),
      player({ id: "6", fullName: "LB", primaryPositionId: "LB", fantasyPts: 14 }),
    ]);

    assert.deepEqual(
      sections.map((section) => section.id),
      [
        "quarterbacks",
        "skill",
        "kickers",
        "defensive-backs",
        "defensive-linemen",
        "linebackers",
      ],
    );

    const backs = sections.find((s) => s.id === "defensive-backs");
    assert.deepEqual(
      backs?.players.map((p) => p.fullName),
      ["S", "CB"],
    );
    assert.equal(backs?.columnPosition, "CB");

    const line = sections.find((s) => s.id === "defensive-linemen");
    assert.deepEqual(
      line?.players.map((p) => p.fullName),
      ["DE", "DT"],
    );

    assert.equal(
      sections.find((s) => s.id === "linebackers")?.players[0]?.fullName,
      "LB",
    );
    assert.equal(
      sections.some((s) => s.id === "defense"),
      false,
    );
  });

  it("keeps Team Defense only when a DEF player is present", () => {
    const sections = groupRosterPlayersForStats([
      player({ id: "d", fullName: "Ravens", primaryPositionId: "DEF" }),
    ]);

    assert.equal(sections.at(-1)?.id, "defense");
    assert.equal(sections.at(-1)?.players[0]?.fullName, "Ravens");
  });
});
