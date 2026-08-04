import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getNflTeamByeWeek,
  resolvePlayerByeWeek,
} from "@/lib/nfl/bye-weeks";

describe("getNflTeamByeWeek", () => {
  it("returns season-specific byes", () => {
    assert.equal(getNflTeamByeWeek("ATL", 2025), 5);
    assert.equal(getNflTeamByeWeek("ATL", 2026), 11);
    assert.equal(getNflTeamByeWeek("CHI", 2025), 5);
    assert.equal(getNflTeamByeWeek("CHI", 2026), 10);
  });

  it("returns null for unknown seasons", () => {
    assert.equal(getNflTeamByeWeek("ATL", 2024), null);
  });
});

describe("resolvePlayerByeWeek", () => {
  it("prefers the season team map over a stale stored bye", () => {
    assert.equal(
      resolvePlayerByeWeek({
        byeWeek: 11,
        nflTeam: "ATL",
        seasonYear: 2025,
      }),
      5,
    );
  });

  it("falls back to stored bye when season map is missing", () => {
    assert.equal(
      resolvePlayerByeWeek({
        byeWeek: 8,
        nflTeam: "ATL",
        seasonYear: 2024,
      }),
      8,
    );
  });
});
