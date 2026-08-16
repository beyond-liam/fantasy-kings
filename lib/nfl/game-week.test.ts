import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GAME_WEEK_FINALIZE_DELAY_MS,
  NFL_GAME_DURATION_MS,
  excludeUnfinalizedGameWeek,
  gameWeekFinalizedAt,
  isGameWeekFinalized,
  isNflSlateComplete,
} from "@/lib/nfl/game-week";

const kickoff = "2026-08-17T00:20:00.000Z";

describe("isNflSlateComplete", () => {
  it("is false for an empty board", () => {
    assert.equal(isNflSlateComplete([]), false);
  });

  it("is false while any game is live or scheduled", () => {
    assert.equal(
      isNflSlateComplete([
        { status: "post" },
        { status: "in" },
      ]),
      false,
    );
    assert.equal(
      isNflSlateComplete([
        { status: "post" },
        { status: "pre" },
      ]),
      false,
    );
  });

  it("is true when every game is post", () => {
    assert.equal(
      isNflSlateComplete([{ status: "post" }, { status: "post" }]),
      true,
    );
  });
});

describe("isGameWeekFinalized", () => {
  const games = [
    { status: "post" as const, kickoff },
    { status: "post" as const, kickoff: "2026-08-16T17:00:00.000Z" },
  ];

  it("is false until 2 hours after the last game's estimated end", () => {
    const at = gameWeekFinalizedAt(games);
    assert.ok(at);
    const last = new Date(kickoff).getTime();
    assert.equal(
      at.getTime(),
      last + NFL_GAME_DURATION_MS + GAME_WEEK_FINALIZE_DELAY_MS,
    );
    assert.equal(isGameWeekFinalized(games, new Date(at.getTime() - 1)), false);
    assert.equal(isGameWeekFinalized(games, at), true);
  });

  it("is false while the slate is incomplete", () => {
    assert.equal(
      isGameWeekFinalized(
        [
          { status: "post", kickoff },
          { status: "in", kickoff },
        ],
        new Date("2026-08-20T00:00:00.000Z"),
      ),
      false,
    );
  });
});

describe("excludeUnfinalizedGameWeek", () => {
  const rows = [{ week: 1 }, { week: 2 }, { week: 3 }];

  it("keeps every week once the game week is finalized", () => {
    assert.deepEqual(excludeUnfinalizedGameWeek(rows, 3, true), rows);
  });

  it("drops the current fantasy week until finalized", () => {
    assert.deepEqual(excludeUnfinalizedGameWeek(rows, 3, false), [
      { week: 1 },
      { week: 2 },
    ]);
  });

  it("keeps rows when there is no current fantasy week", () => {
    assert.deepEqual(excludeUnfinalizedGameWeek(rows, null, false), rows);
  });
});
