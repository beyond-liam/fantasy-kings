import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getFantasyWeekStartUtc,
  getFcfsOpensAtUtc,
  getLastProcessInstantUtc,
  isFcfsWindowOpen,
  isWaiverProcessDue,
} from "@/lib/leagues/waivers/calendar";
import { getAcquisitionKind } from "@/lib/leagues/waivers/acquisition";
import {
  adjudicateWaiverClaims,
  moveWinnersToBottom,
} from "@/lib/leagues/waivers/adjudicate";
import { resolveChurnCut } from "@/lib/leagues/waivers/churn";
import {
  formatWaiverAwardSummary,
  formatWaiverFailSummary,
} from "@/lib/leagues/waivers/activity";
import { DEFAULT_WAIVER_WIRE_SETTINGS } from "@/lib/leagues/waiver-wire";

describe("waiver calendar", () => {
  it("uses Wed 00:01 UTC as week start", () => {
    const wedMorning = new Date(Date.UTC(2026, 6, 15, 10, 0, 0)); // Wed
    const start = getFantasyWeekStartUtc(wedMorning);
    assert.equal(start.toISOString(), "2026-07-15T00:01:00.000Z");
  });

  it("opens FCFS two hours after process", () => {
    const processAt = new Date(Date.UTC(2026, 6, 15, 10, 0, 0));
    assert.equal(
      getFcfsOpensAtUtc(processAt).toISOString(),
      "2026-07-15T12:00:00.000Z",
    );
  });

  it("detects FCFS window after Wed process", () => {
    const justBefore = new Date(Date.UTC(2026, 6, 15, 11, 59, 0));
    const justAfter = new Date(Date.UTC(2026, 6, 15, 12, 0, 0));
    assert.equal(isFcfsWindowOpen(["wed"], justBefore), false);
    assert.equal(isFcfsWindowOpen(["wed"], justAfter), true);
  });

  it("finds last Wednesday 10:00 process", () => {
    const thursday = new Date(Date.UTC(2026, 6, 16, 8, 0, 0));
    const last = getLastProcessInstantUtc(["wed"], thursday);
    assert.equal(last?.toISOString(), "2026-07-15T10:00:00.000Z");
  });

  it("marks process as due inside the post-10:00 grace window", () => {
    const atProcess = new Date(Date.UTC(2026, 6, 15, 10, 5, 0));
    assert.equal(
      isWaiverProcessDue({
        processDays: ["wed"],
        lastWaiverProcessedAt: null,
        now: atProcess,
      }),
      true,
    );
    assert.equal(
      isWaiverProcessDue({
        processDays: ["wed"],
        lastWaiverProcessedAt: new Date(Date.UTC(2026, 6, 15, 10, 0, 0)),
        now: atProcess,
      }),
      false,
    );
    assert.equal(
      isWaiverProcessDue({
        processDays: ["wed"],
        lastWaiverProcessedAt: null,
        now: new Date(Date.UTC(2026, 6, 15, 11, 5, 0)),
      }),
      false,
    );
  });
});

describe("getAcquisitionKind", () => {
  const base = {
    waiversEnabled: true,
    waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
    rosterTransactionsEnabled: true,
    now: new Date(Date.UTC(2026, 6, 15, 13, 0, 0)), // Wed 13:00 — FCFS open
  };

  it("returns owned when on a team", () => {
    assert.equal(
      getAcquisitionKind({
        ...base,
        ownership: { fantasyTeamId: "t1", onWaivers: false },
      }),
      "owned",
    );
  });

  it("requires claim while on waivers", () => {
    assert.equal(
      getAcquisitionKind({
        ...base,
        ownership: { fantasyTeamId: null, onWaivers: true },
      }),
      "claim",
    );
  });

  it("allows add in FCFS window for free agents", () => {
    assert.equal(
      getAcquisitionKind({
        ...base,
        ownership: { fantasyTeamId: null, onWaivers: false },
      }),
      "add",
    );
  });

  it("requires claim before FCFS opens", () => {
    assert.equal(
      getAcquisitionKind({
        ...base,
        now: new Date(Date.UTC(2026, 6, 15, 11, 0, 0)),
        ownership: { fantasyTeamId: null, onWaivers: false },
      }),
      "claim",
    );
  });
});

describe("adjudicateWaiverClaims", () => {
  it("awards priority to better priority number", () => {
    const result = adjudicateWaiverClaims({
      waiverType: "priority",
      claims: [
        {
          id: "c1",
          teamId: "a",
          playerId: "p1",
          dropPlayerId: null,
          bid: null,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          sortOrder: 1,
          waiverPriority: 3,
          faabRemaining: null,
        },
        {
          id: "c2",
          teamId: "b",
          playerId: "p1",
          dropPlayerId: null,
          bid: null,
          createdAt: new Date("2026-01-01T01:00:00Z"),
          sortOrder: 1,
          waiverPriority: 1,
          faabRemaining: null,
        },
      ],
    });
    const awarded = result.outcomes.find((row) => row.status === "awarded");
    assert.equal(awarded?.claimId, "c2");
    assert.deepEqual(result.winnersInOrder, ["b"]);
  });

  it("awards FAAB to highest bid", () => {
    const result = adjudicateWaiverClaims({
      waiverType: "faab",
      claims: [
        {
          id: "c1",
          teamId: "a",
          playerId: "p1",
          dropPlayerId: null,
          bid: 5,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          sortOrder: 1,
          waiverPriority: 1,
          faabRemaining: 100,
        },
        {
          id: "c2",
          teamId: "b",
          playerId: "p1",
          dropPlayerId: null,
          bid: 12,
          createdAt: new Date("2026-01-01T01:00:00Z"),
          sortOrder: 1,
          waiverPriority: 2,
          faabRemaining: 100,
        },
      ],
    });
    assert.equal(
      result.outcomes.find((row) => row.status === "awarded")?.claimId,
      "c2",
    );
    assert.equal(result.faabSpendByTeam.get("b"), 12);
  });

  it("keeps only the preferred claim when a team would win multiple", () => {
    const result = adjudicateWaiverClaims({
      waiverType: "priority",
      claims: [
        {
          id: "c1",
          teamId: "a",
          playerId: "p1",
          dropPlayerId: null,
          bid: null,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          sortOrder: 2,
          waiverPriority: 1,
          faabRemaining: null,
        },
        {
          id: "c2",
          teamId: "a",
          playerId: "p2",
          dropPlayerId: null,
          bid: null,
          createdAt: new Date("2026-01-01T01:00:00Z"),
          sortOrder: 1,
          waiverPriority: 1,
          faabRemaining: null,
        },
      ],
    });
    assert.equal(
      result.outcomes.find((row) => row.claimId === "c2")?.status,
      "awarded",
    );
    assert.equal(
      result.outcomes.find((row) => row.claimId === "c1")?.status,
      "failed",
    );
    assert.equal(
      result.outcomes.find((row) => row.claimId === "c1")?.failReason,
      "Higher-priority claim succeeded.",
    );
  });

  it("moves winners to bottom of priority", () => {
    const next = moveWinnersToBottom(
      [
        { teamId: "a", waiverPriority: 1 },
        { teamId: "b", waiverPriority: 2 },
        { teamId: "c", waiverPriority: 3 },
      ],
      ["a"],
    );
    assert.deepEqual(next, [
      { teamId: "b", waiverPriority: 1 },
      { teamId: "c", waiverPriority: 2 },
      { teamId: "a", waiverPriority: 3 },
    ]);
  });
});

describe("resolveChurnCut", () => {
  it("returns recently acquired players to free agency", () => {
    const decision = resolveChurnCut({
      churnPrevention: "return_to_fa",
      processDays: ["wed"],
      dropWaiverHours: 24,
      acquiredAt: new Date(Date.UTC(2026, 6, 15, 14, 0, 0)),
      now: new Date(Date.UTC(2026, 6, 16, 12, 0, 0)),
    });
    assert.deepEqual(decision, { allow: true, skipWaivers: true });
  });

  it("blocks late drops that would miss the next process", () => {
    const decision = resolveChurnCut({
      churnPrevention: "block_late_drops",
      processDays: ["wed"],
      dropWaiverHours: 48,
      acquiredAt: null,
      now: new Date(Date.UTC(2026, 6, 21, 12, 0, 0)),
    });
    assert.equal(decision.allow, false);
  });
});

describe("waiver activity summaries", () => {
  it("formats awarded and failed claim summaries", () => {
    assert.equal(
      formatWaiverAwardSummary({
        teamName: "Kings",
        playerName: "Josh Allen",
        bid: 12,
        dropPlayerName: "Backup QB",
        waiverType: "faab",
      }),
      "Kings claimed Josh Allen for $12 (dropped Backup QB).",
    );
    assert.equal(
      formatWaiverFailSummary({
        teamName: "Kings",
        playerName: "Josh Allen",
        failReason: "Outbid.",
      }),
      "Kings claim on Josh Allen failed — Outbid.",
    );
  });
});
