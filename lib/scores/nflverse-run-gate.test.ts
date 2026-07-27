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

  it("runs when games array is empty and scoreboardOk=true", () => {
    assert.equal(
      shouldAutoRunNflverse({ force: false, scoreboardOk: true, games: [] }),
      true,
    );
  });

  it("runs when scoreboardOk=false (current behavior, treats outage as done)", () => {
    assert.equal(
      shouldAutoRunNflverse({ force: false, scoreboardOk: false, games: [] }),
      true,
    );
  });
});
