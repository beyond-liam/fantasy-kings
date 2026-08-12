import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildClaimResolution,
  formatClaimResolutionFailLabel,
  isIllegalRosterFailReason,
  orderClaimsForResolution,
} from "@/lib/leagues/waivers/claim-resolution";

describe("claim resolution", () => {
  it("orders FAAB by bid descending", () => {
    const ordered = orderClaimsForResolution(
      [
        {
          teamId: "a",
          bid: 0,
          waiverPriority: 1,
          createdAt: new Date("2026-08-01T00:00:00Z"),
        },
        {
          teamId: "b",
          bid: 100,
          waiverPriority: 3,
          createdAt: new Date("2026-08-01T00:00:00Z"),
        },
      ],
      "faab",
    );
    assert.deepEqual(
      ordered.map((row) => row.teamId),
      ["b", "a"],
    );
  });

  it("orders priority by waiver priority ascending", () => {
    const ordered = orderClaimsForResolution(
      [
        {
          teamId: "a",
          bid: null,
          waiverPriority: 4,
          createdAt: new Date("2026-08-01T00:00:00Z"),
        },
        {
          teamId: "b",
          bid: null,
          waiverPriority: 1,
          createdAt: new Date("2026-08-01T00:00:00Z"),
        },
      ],
      "priority",
    );
    assert.deepEqual(
      ordered.map((row) => row.teamId),
      ["b", "a"],
    );
  });

  it("marks illegal roster failures and winning bids", () => {
    const resolution = buildClaimResolution({
      waiverType: "faab",
      teamNameById: new Map([
        ["x", "Team X"],
        ["y", "Team Y"],
      ]),
      claims: [
        {
          id: "1",
          teamId: "x",
          bid: 100,
          waiverPriority: 2,
          createdAt: new Date("2026-08-01T00:00:00Z"),
        },
        {
          id: "2",
          teamId: "y",
          bid: 0,
          waiverPriority: 1,
          createdAt: new Date("2026-08-01T00:00:00Z"),
        },
      ],
      statusByClaimId: new Map([
        ["1", { status: "failed", failReason: "Illegal roster." }],
        ["2", { status: "awarded", failReason: null }],
      ]),
    });
    assert.equal(resolution[0]?.status, "illegal_roster");
    assert.equal(resolution[1]?.status, "won");
    assert.equal(formatClaimResolutionFailLabel("Illegal roster."), "illegal roster");
    assert.equal(isIllegalRosterFailReason("At max QBs — choose a different drop."), true);
  });
});
