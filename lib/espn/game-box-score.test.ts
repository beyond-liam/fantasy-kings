import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseGameBoxScore } from "@/lib/espn/game-box-score";

describe("parseGameBoxScore", () => {
  it("keeps ESPN display columns and a TEAM total row", () => {
    const result = parseGameBoxScore(
      {
        boxscore: {
          players: [
            {
              team: { abbreviation: "CAR" },
              statistics: [
                {
                  name: "passing",
                  text: "Carolina Passing",
                  labels: ["C/ATT", "YDS", "AVG", "TD", "INT", "SACKS", "RTG"],
                  descriptions: [
                    "Completions/Attempts",
                    "Yards",
                    "Yards Per Pass Attempt",
                    "Touchdowns",
                    "Interceptions",
                    "Sacks",
                    "Passer Rating",
                  ],
                  totals: ["16/19", "92", "4.8", "1", "0", "3-17", "104.4"],
                  athletes: [
                    {
                      athlete: {
                        id: "4240703",
                        displayName: "Kenny Pickett",
                        jersey: "12",
                      },
                      stats: [
                        "16/19",
                        "92",
                        "4.8",
                        "1",
                        "0",
                        "3-17",
                        "104.4",
                      ],
                    },
                  ],
                },
                {
                  name: "fumbles",
                  text: "Carolina Fumbles",
                  labels: ["FUM", "LOST", "REC"],
                  totals: [],
                  athletes: [],
                },
              ],
            },
            {
              team: { abbreviation: "BUF" },
              statistics: [],
            },
          ],
        },
      },
      "CAR",
      "BUF",
    );

    assert.equal(result?.away.categories[0]?.title, "Carolina Passing");
    assert.deepEqual(
      result?.away.categories[0]?.columns.map((column) => column.label),
      ["C/ATT", "YDS", "AVG", "TD", "INT", "SACKS", "RTG"],
    );
    assert.equal(
      result?.away.categories[0]?.columns[0]?.description,
      "Completions/Attempts",
    );
    assert.equal(result?.away.categories[0]?.rows[0]?.name, "Kenny Pickett");
    assert.deepEqual(result?.away.categories[0]?.totals, [
      "16/19",
      "92",
      "4.8",
      "1",
      "0",
      "3-17",
      "104.4",
    ]);
    assert.equal(result?.away.categories[1]?.rows.length, 0);
    assert.equal(result?.away.categories[1]?.totals, null);
  });

  it("aligns stats to labels when ESPN keys include extra fields", () => {
    const result = parseGameBoxScore(
      {
        boxscore: {
          players: [
            {
              team: { abbreviation: "CAR" },
              statistics: [
                {
                  name: "passing",
                  text: "Carolina Passing",
                  labels: ["C/ATT", "YDS", "AVG", "TD", "INT", "SACKS", "RTG"],
                  athletes: [
                    {
                      athlete: { id: "1", displayName: "QB" },
                      stats: ["6/8", "111", "13.9", "1", "0", "1-8", "156.2"],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      "CAR",
      "BUF",
    );

    assert.equal(result?.away.categories[0]?.rows[0]?.stats.length, 7);
    assert.equal(result?.home.categories.length, 0);
  });
});
