import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isAutomatedScoreSyncRequest,
  shouldRunAutomatedScoreSync,
} from "./automated-sync-gate";

const NOW = new Date("2026-09-03T18:00:00.000Z");

describe("shouldRunAutomatedScoreSync", () => {
  it("runs while any NFL game is live", () => {
    assert.equal(
      shouldRunAutomatedScoreSync({
        scoreboardOk: true,
        now: NOW,
        games: [{ status: "in", kickoff: "2026-09-03T12:00:00.000Z" }],
      }),
      true,
    );
  });

  it("runs shortly before kickoff and through the post-game sync window", () => {
    assert.equal(
      shouldRunAutomatedScoreSync({
        scoreboardOk: true,
        now: NOW,
        games: [{ status: "pre", kickoff: "2026-09-03T18:20:00.000Z" }],
      }),
      true,
    );
    assert.equal(
      shouldRunAutomatedScoreSync({
        scoreboardOk: true,
        now: NOW,
        games: [{ status: "post", kickoff: "2026-09-03T12:30:00.000Z" }],
      }),
      true,
    );
  });

  it("skips distant future and stale completed slates", () => {
    assert.equal(
      shouldRunAutomatedScoreSync({
        scoreboardOk: true,
        now: NOW,
        games: [{ status: "pre", kickoff: "2026-09-04T18:00:00.000Z" }],
      }),
      false,
    );
    assert.equal(
      shouldRunAutomatedScoreSync({
        scoreboardOk: true,
        now: NOW,
        games: [{ status: "post", kickoff: "2026-09-03T08:00:00.000Z" }],
      }),
      false,
    );
  });

  it("fails closed when the scoreboard is unavailable or empty", () => {
    assert.equal(
      shouldRunAutomatedScoreSync({
        scoreboardOk: false,
        now: NOW,
        games: [],
      }),
      false,
    );
    assert.equal(
      shouldRunAutomatedScoreSync({
        scoreboardOk: true,
        now: NOW,
        games: [],
      }),
      false,
    );
  });
});

describe("isAutomatedScoreSyncRequest", () => {
  it("requires an explicit force flag to bypass the scheduler guard", () => {
    assert.equal(isAutomatedScoreSyncRequest({}), true);
    assert.equal(isAutomatedScoreSyncRequest({ forceSync: true }), false);
    assert.equal(isAutomatedScoreSyncRequest({ forceNflverse: true }), false);
  });
});
