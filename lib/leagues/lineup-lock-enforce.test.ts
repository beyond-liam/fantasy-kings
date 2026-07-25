import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findBlockedAcquisitionAdd,
  findBlockedAcquisitionCut,
  findBlockedLineupMoves,
  isLineupEditBlocked,
} from "@/lib/leagues/lineup-lock-enforce";

describe("isLineupEditBlocked", () => {
  it("allows bench-only moves under first_game even after kickoff", () => {
    assert.equal(
      isLineupEditBlocked({
        mode: "first_game",
        previousSlot: "BN",
        nextSlot: "IR",
        playerNflTeam: "BUF",
        startedTeams: new Set(["KC"]),
      }),
      false,
    );
  });

  it("blocks starter moves under first_game once any game started", () => {
    assert.equal(
      isLineupEditBlocked({
        mode: "first_game",
        previousSlot: "QB",
        nextSlot: "BN",
        playerNflTeam: "BUF",
        startedTeams: new Set(["KC"]),
      }),
      true,
    );
  });

  it("blocks only the started player's moves under individual", () => {
    assert.equal(
      isLineupEditBlocked({
        mode: "individual",
        previousSlot: "RB",
        nextSlot: "BN",
        playerNflTeam: "KC",
        startedTeams: new Set(["KC"]),
      }),
      true,
    );
    assert.equal(
      isLineupEditBlocked({
        mode: "individual",
        previousSlot: "RB",
        nextSlot: "BN",
        playerNflTeam: "BUF",
        startedTeams: new Set(["KC"]),
      }),
      false,
    );
  });
});

describe("findBlockedLineupMoves", () => {
  it("returns a message for the first blocked change", () => {
    const message = findBlockedLineupMoves({
      mode: "individual",
      startedTeams: new Set(["BUF"]),
      changes: [
        {
          fullName: "Josh Allen",
          nflTeam: "BUF",
          previousSlot: "QB",
          nextSlot: "BN",
        },
      ],
    });
    assert.match(message ?? "", /Josh Allen/);
  });
});

describe("findBlockedAcquisitionAdd", () => {
  it("blocks adding into a starter under first_game after kickoff", () => {
    const message = findBlockedAcquisitionAdd({
      mode: "first_game",
      startedTeams: new Set(["KC"]),
      fullName: "Free Agent",
      nflTeam: "BUF",
      nextSlot: "RB",
    });
    assert.match(message ?? "", /Free Agent/);
  });

  it("allows adding to bench under first_game", () => {
    assert.equal(
      findBlockedAcquisitionAdd({
        mode: "first_game",
        startedTeams: new Set(["KC"]),
        fullName: "Free Agent",
        nflTeam: "BUF",
        nextSlot: "BN",
      }),
      null,
    );
  });
});

describe("findBlockedAcquisitionCut", () => {
  it("blocks cutting a locked starter under individual", () => {
    const message = findBlockedAcquisitionCut({
      mode: "individual",
      startedTeams: new Set(["BUF"]),
      fullName: "Josh Allen",
      nflTeam: "BUF",
      previousSlot: "QB",
    });
    assert.match(message ?? "", /Josh Allen/);
  });
});
