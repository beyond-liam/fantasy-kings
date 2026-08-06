import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  IN_SEASON_INACTIVITY_MS,
  OFFSEASON_INACTIVITY_MS,
  PRESENCE_ONLINE_WINDOW_MS,
  formatPresenceLabel,
  getInactivityWindowMs,
  isInSeasonNflPhase,
  resolvePresenceStatus,
} from "./presence";

const NOW = new Date("2027-01-31T12:00:00.000Z");

function ago(milliseconds: number) {
  return new Date(NOW.getTime() - milliseconds);
}

describe("presence status", () => {
  it("formats the requested tooltip labels", () => {
    const lastSeenAt = new Date("2027-01-23T12:00:00.000Z");

    assert.equal(
      formatPresenceLabel({ status: "online", lastSeenAt }),
      "Online",
    );
    assert.equal(
      formatPresenceLabel({ status: "offline", lastSeenAt }),
      "Last seen 23rd Jan 2027 · 12:00",
    );
    assert.equal(
      formatPresenceLabel({ status: "inactive", lastSeenAt }),
      "Inactive since 23rd Jan 2027 · 12:00",
    );
  });

  it("treats regular season and playoffs as in-season", () => {
    assert.equal(isInSeasonNflPhase("regular"), true);
    assert.equal(isInSeasonNflPhase("post"), true);
    assert.equal(isInSeasonNflPhase("pre"), false);
    assert.equal(isInSeasonNflPhase("off"), false);
  });

  it("uses the requested inactivity window for each NFL phase", () => {
    assert.equal(getInactivityWindowMs("regular"), IN_SEASON_INACTIVITY_MS);
    assert.equal(getInactivityWindowMs("post"), IN_SEASON_INACTIVITY_MS);
    assert.equal(getInactivityWindowMs("pre"), OFFSEASON_INACTIVITY_MS);
    assert.equal(getInactivityWindowMs("off"), OFFSEASON_INACTIVITY_MS);
  });

  it("keeps a fresh heartbeat online for two minutes", () => {
    assert.equal(
      resolvePresenceStatus({
        lastSeenAt: ago(PRESENCE_ONLINE_WINDOW_MS),
        nflSeasonType: "regular",
        now: NOW,
      }),
      "online",
    );
  });

  it("marks users offline after the online window", () => {
    assert.equal(
      resolvePresenceStatus({
        lastSeenAt: ago(PRESENCE_ONLINE_WINDOW_MS + 1),
        nflSeasonType: "regular",
        now: NOW,
      }),
      "offline",
    );
  });

  it("marks users inactive after 14 days in-season", () => {
    assert.equal(
      resolvePresenceStatus({
        lastSeenAt: ago(IN_SEASON_INACTIVITY_MS),
        nflSeasonType: "regular",
        now: NOW,
      }),
      "inactive",
    );
  });

  it("waits 30 days before marking users inactive in the offseason", () => {
    assert.equal(
      resolvePresenceStatus({
        lastSeenAt: ago(IN_SEASON_INACTIVITY_MS),
        nflSeasonType: "off",
        now: NOW,
      }),
      "offline",
    );
    assert.equal(
      resolvePresenceStatus({
        lastSeenAt: ago(OFFSEASON_INACTIVITY_MS),
        nflSeasonType: "off",
        now: NOW,
      }),
      "inactive",
    );
  });

  it("treats future server timestamps as online", () => {
    assert.equal(
      resolvePresenceStatus({
        lastSeenAt: new Date(NOW.getTime() + 1000),
        nflSeasonType: "regular",
        now: NOW,
      }),
      "online",
    );
  });
});
