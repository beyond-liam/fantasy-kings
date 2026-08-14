import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseEspnTeamDefBoxscore } from "@/lib/espn/team-def-boxscore";

describe("parseEspnTeamDefBoxscore", () => {
  it("uses opponent score as points allowed and sums that team's sacks", () => {
    const lines = parseEspnTeamDefBoxscore({
      header: {
        competitions: [
          {
            competitors: [
              {
                homeAway: "home",
                score: "7",
                team: { abbreviation: "HOU" },
              },
              {
                homeAway: "away",
                score: "27",
                team: { abbreviation: "LAC" },
              },
            ],
          },
        ],
      },
      boxscore: {
        players: [
          {
            team: { abbreviation: "HOU" },
            statistics: [
              {
                name: "defensive",
                keys: ["sacks", "fumblesForced"],
                athletes: [
                  {
                    athlete: { id: "1", displayName: "Naquan Jones" },
                    stats: ["1", "0"],
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const hou = lines.find((line) => line.teamAbbreviation === "HOU");
    const lac = lines.find((line) => line.teamAbbreviation === "LAC");
    assert.ok(hou);
    assert.ok(lac);
    assert.equal(hou.stats.pts_allow, 27);
    assert.equal(hou.stats.sack, 1);
    assert.equal(lac.stats.pts_allow, 7);
    assert.equal(lac.stats.pts_allow_0, undefined);
  });

  it("flags a shutout and maps WSH onto WAS", () => {
    const lines = parseEspnTeamDefBoxscore({
      header: {
        competitions: [
          {
            competitors: [
              { score: "0", team: { abbreviation: "WSH" } },
              { score: "17", team: { abbreviation: "DAL" } },
            ],
          },
        ],
      },
    });

    const was = lines.find((line) => line.teamAbbreviation === "WAS");
    const dal = lines.find((line) => line.teamAbbreviation === "DAL");
    assert.ok(was);
    assert.ok(dal);
    assert.equal(was.stats.pts_allow, 17);
    assert.equal(dal.stats.pts_allow, 0);
    assert.equal(dal.stats.pts_allow_0, 1);
  });

  it("fills sacks and recoveries from the opponent team boxscore when needed", () => {
    const lines = parseEspnTeamDefBoxscore({
      header: {
        competitions: [
          {
            competitors: [
              { score: "14", team: { abbreviation: "HOU" } },
              { score: "21", team: { abbreviation: "LAC" } },
            ],
          },
        ],
      },
      boxscore: {
        teams: [
          {
            team: { abbreviation: "LAC" },
            statistics: [
              { name: "sacksYardsLost", displayValue: "3-19" },
              { name: "fumblesLost", displayValue: "2" },
              { name: "interceptionsThrown", displayValue: "1" },
            ],
          },
          {
            team: { abbreviation: "HOU" },
            statistics: [{ name: "sacksYardsLost", displayValue: "0-0" }],
          },
        ],
      },
    });

    const hou = lines.find((line) => line.teamAbbreviation === "HOU");
    assert.ok(hou);
    assert.equal(hou.stats.sack, 3);
    assert.equal(hou.stats.fum_rec, 2);
    assert.equal(hou.stats.int, 1);
  });

  it("does not treat a missing score as a shutout", () => {
    const lines = parseEspnTeamDefBoxscore({
      header: {
        competitions: [
          {
            competitors: [
              { team: { abbreviation: "HOU" } },
              { team: { abbreviation: "LAC" } },
            ],
          },
        ],
      },
      boxscore: {
        players: [
          {
            team: { abbreviation: "HOU" },
            statistics: [
              {
                name: "defensive",
                keys: ["sacks"],
                athletes: [
                  {
                    athlete: { id: "1", displayName: "Naquan Jones" },
                    stats: ["1"],
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const hou = lines.find((line) => line.teamAbbreviation === "HOU");
    assert.ok(hou);
    assert.equal(hou.stats.sack, 1);
    assert.equal(hou.stats.pts_allow, undefined);
    assert.equal(hou.stats.pts_allow_0, undefined);
  });
});
