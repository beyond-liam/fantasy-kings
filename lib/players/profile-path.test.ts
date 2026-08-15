import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isPlayerProfilePath,
  playerProfileFallbackHref,
  playerProfileHref,
  playerProfileReturnFromReferrer,
} from "@/lib/players/profile-path";

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

describe("isPlayerProfilePath", () => {
  it("matches league and global player profile routes", () => {
    assert.equal(isPlayerProfilePath("/players/abc"), true);
    assert.equal(isPlayerProfilePath("/league/my-league/players/abc"), true);
    assert.equal(isPlayerProfilePath("/league/my-league/players"), false);
    assert.equal(isPlayerProfilePath("/rankings"), false);
  });
});

describe("playerProfileReturnFromReferrer", () => {
  const origin = "https://example.com";

  it("keeps the filtered page that opened the profile", () => {
    assert.equal(
      playerProfileReturnFromReferrer({
        referrer: "https://example.com/league/my-league/players?pos=RB&week=2",
        origin,
      }),
      "/league/my-league/players?pos=RB&week=2",
    );
  });

  it("ignores season switches that refer from another profile URL", () => {
    assert.equal(
      playerProfileReturnFromReferrer({
        referrer: "https://example.com/league/my-league/players/abc?season=2025",
        origin,
      }),
      null,
    );
  });

  it("ignores missing and cross-origin referrers", () => {
    assert.equal(
      playerProfileReturnFromReferrer({ referrer: "", origin }),
      null,
    );
    assert.equal(
      playerProfileReturnFromReferrer({
        referrer: "https://other.test/rankings",
        origin,
      }),
      null,
    );
  });
});

describe("playerProfileFallbackHref", () => {
  it("uses the league Players list when a slug is present", () => {
    assert.equal(
      playerProfileFallbackHref("my-league"),
      "/league/my-league/players",
    );
  });

  it("uses Rankings without a league", () => {
    assert.equal(playerProfileFallbackHref(null), "/rankings");
  });
});
