import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldAutoRunNflverse } from "./nflverse-run-gate";

describe("shouldAutoRunNflverse", () => {
  it("runs when force=true regardless of scoreboard", () => {
    assert.equal(
      shouldAutoRunNflverse({
        force: true,
        scoreboardOk: false,
        games: [],
      }),
      true,
    );

    const liveGames = [{ status: "in" }];
    assert.equal(
      shouldAutoRunNflverse({ force: true, scoreboardOk: true, games: liveGames }),
      true,
    );
  });

  it("skips when games are live (status=in)", () => {
    const liveGames = [{ status: "in" }];
    assert.equal(
      shouldAutoRunNflverse({ force: false, scoreboardOk: true, games: liveGames }),
      false,
    );
  });

  it("runs when all games are post", () => {
    const postGames = [{ status: "post" }];
    assert.equal(
      shouldAutoRunNflverse({ force: false, scoreboardOk: true, games: postGames }),
      true,
    );
  });

  it("skips when games are mixed pre and post (requires ALL post)", () => {
    const mixedGames = [{ status: "pre" }, { status: "post" }];
    assert.equal(
      shouldAutoRunNflverse({ force: false, scoreboardOk: true, games: mixedGames }),
      false,
    );
  });

  it("skips when games array is empty even with scoreboardOk=true (fail-closed)", () => {
    assert.equal(
      shouldAutoRunNflverse({ force: false, scoreboardOk: true, games: [] }),
      false,
    );
  });

  it("skips when scoreboardOk=false (fail-closed, no visibility)", () => {
    assert.equal(
      shouldAutoRunNflverse({ force: false, scoreboardOk: false, games: [] }),
      false,
    );
  });
});
