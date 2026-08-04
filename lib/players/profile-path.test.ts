import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { playerProfileHref } from "@/lib/players/profile-path";

describe("playerProfileHref", () => {
  it("uses league-scoped path when leagueSlug is set", () => {
    assert.equal(
      playerProfileHref({
        playerId: "p1",
        leagueSlug: "my-league",
        season: "2025",
      }),
      "/league/my-league/players/p1?season=2025",
    );
  });

  it("falls back to global /players path without a league", () => {
    assert.equal(
      playerProfileHref({ playerId: "p1", season: "2025" }),
      "/players/p1?season=2025",
    );
  });
});
