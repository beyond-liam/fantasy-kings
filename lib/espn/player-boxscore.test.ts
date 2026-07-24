import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyEspnCategoryStats,
  parseEspnPlayerBoxscore,
} from "@/lib/espn/player-boxscore";

describe("espn player boxscore", () => {
  it("maps passing / rushing / receiving compound keys", () => {
    const bag: Record<string, number> = {};
    applyEspnCategoryStats(
      bag,
      "passing",
      [
        "completions/passingAttempts",
        "passingYards",
        "passingTouchdowns",
        "interceptions",
      ],
      ["21/34", "188", "0", "1"],
    );
    applyEspnCategoryStats(
      bag,
      "rushing",
      ["rushingAttempts", "rushingYards", "rushingTouchdowns"],
      ["4", "22", "1"],
    );
    assert.deepEqual(bag, {
      pass_cmp: 21,
      pass_att: 34,
      pass_yd: 188,
      pass_td: 0,
      pass_int: 1,
      rush_att: 4,
      rush_yd: 22,
      rush_td: 1,
    });
  });

  it("maps kicking made/attempt pairs", () => {
    const bag: Record<string, number> = {};
    applyEspnCategoryStats(
      bag,
      "kicking",
      [
        "fieldGoalsMade/fieldGoalAttempts",
        "extraPointsMade/extraPointAttempts",
      ],
      ["1/1", "3/3"],
    );
    assert.deepEqual(bag, { fgm: 1, fga: 1, xpm: 3, xpa: 3 });
  });

  it("merges multi-category athletes by espn id", () => {
    const lines = parseEspnPlayerBoxscore({
      boxscore: {
        players: [
          {
            team: { abbreviation: "DAL" },
            statistics: [
              {
                name: "passing",
                keys: [
                  "completions/passingAttempts",
                  "passingYards",
                  "passingTouchdowns",
                  "interceptions",
                ],
                athletes: [
                  {
                    athlete: { id: "2577417", displayName: "Dak Prescott" },
                    stats: ["21/34", "188", "0", "0"],
                  },
                ],
              },
              {
                name: "rushing",
                keys: [
                  "rushingAttempts",
                  "rushingYards",
                  "rushingTouchdowns",
                ],
                athletes: [
                  {
                    athlete: { id: "2577417", displayName: "Dak Prescott" },
                    stats: ["1", "3", "0"],
                  },
                ],
              },
              {
                name: "receiving",
                keys: [
                  "receptions",
                  "receivingYards",
                  "receivingTouchdowns",
                  "receivingTargets",
                ],
                athletes: [
                  {
                    athlete: { id: "4241389", displayName: "CeeDee Lamb" },
                    stats: ["7", "110", "0", "13"],
                  },
                ],
              },
              {
                name: "punting",
                keys: ["punts"],
                athletes: [
                  {
                    athlete: { id: "999", displayName: "Punter" },
                    stats: ["3"],
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    assert.equal(lines.length, 2);
    const dak = lines.find((line) => line.espnAthleteId === "2577417");
    const ceedee = lines.find((line) => line.espnAthleteId === "4241389");
    assert.ok(dak);
    assert.ok(ceedee);
    assert.equal(dak.stats.pass_yd, 188);
    assert.equal(dak.stats.rush_yd, 3);
    assert.equal(ceedee.stats.rec, 7);
    assert.equal(ceedee.stats.rec_tgt, 13);
  });
});
