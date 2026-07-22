import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildOwnershipMap,
  type OwnershipMapRow,
} from "@/lib/queries/roster";

const NOW = Date.parse("2026-07-12T12:00:00.000Z");
const USER_A = "user-a";
const USER_B = "user-b";

function row(
  partial: Partial<OwnershipMapRow> &
    Pick<OwnershipMapRow, "playerId" | "status" | "teamId">,
): OwnershipMapRow {
  return {
    teamName: `Team ${partial.teamId}`,
    teamSlug: partial.teamId,
    userId: USER_A,
    waiverClearsAt: null,
    ...partial,
  };
}

describe("buildOwnershipMap", () => {
  it("maps a single rostered player to their team", () => {
    const map = buildOwnershipMap(
      [
        row({
          playerId: "p1",
          status: "rostered",
          teamId: "team-b",
          teamName: "Bobcats",
          userId: USER_B,
        }),
      ],
      USER_A,
      NOW,
    );

    assert.deepEqual(map.get("p1"), {
      fantasyTeamId: "team-b",
      fantasyTeamName: "Bobcats",
      fantasyTeamSlug: "team-b",
      isOwnedByCurrentUser: false,
      onWaivers: false,
    });
  });

  it("marks active waived players as on waivers", () => {
    const map = buildOwnershipMap(
      [
        row({
          playerId: "p1",
          status: "waived",
          teamId: "team-a",
          waiverClearsAt: new Date(NOW + 60_000),
        }),
      ],
      USER_A,
      NOW,
    );

    assert.deepEqual(map.get("p1"), {
      fantasyTeamId: null,
      fantasyTeamName: null,
      fantasyTeamSlug: null,
      isOwnedByCurrentUser: false,
      onWaivers: true,
    });
  });

  it("treats expired waived players as free agents", () => {
    const map = buildOwnershipMap(
      [
        row({
          playerId: "p1",
          status: "waived",
          teamId: "team-a",
          waiverClearsAt: new Date(NOW - 60_000),
        }),
      ],
      USER_A,
      NOW,
    );

    assert.equal(map.has("p1"), false);
  });

  it("lets rostered win over waived for the same player", () => {
    const map = buildOwnershipMap(
      [
        row({
          playerId: "p1",
          status: "waived",
          teamId: "team-z",
          waiverClearsAt: new Date(NOW + 60_000),
        }),
        row({
          playerId: "p1",
          status: "rostered",
          teamId: "team-a",
          teamName: "Aces",
          userId: USER_A,
        }),
      ],
      USER_A,
      NOW,
    );

    assert.deepEqual(map.get("p1"), {
      fantasyTeamId: "team-a",
      fantasyTeamName: "Aces",
      fantasyTeamSlug: "team-a",
      isOwnedByCurrentUser: true,
      onWaivers: false,
    });
  });

  it("picks the lowest teamId when multiple rostered rows exist", () => {
    const map = buildOwnershipMap(
      [
        row({
          playerId: "p1",
          status: "rostered",
          teamId: "team-c",
          teamName: "Cougars",
          userId: USER_B,
        }),
        row({
          playerId: "p1",
          status: "rostered",
          teamId: "team-a",
          teamName: "Aces",
          userId: USER_A,
        }),
      ],
      USER_A,
      NOW,
    );

    assert.deepEqual(map.get("p1"), {
      fantasyTeamId: "team-a",
      fantasyTeamName: "Aces",
      fantasyTeamSlug: "team-a",
      isOwnedByCurrentUser: true,
      onWaivers: false,
    });
  });
});
