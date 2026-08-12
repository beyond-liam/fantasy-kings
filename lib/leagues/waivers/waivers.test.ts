import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WaiverProcessDay } from "@/db/schema/league-seasons";
import {
  formatWaiverInstantUtc,
  getClaimDeadlineForProcess,
  getFantasyWeekStartUtc,
  getFcfsOpensAtUtc,
  getLastProcessInstantUtc,
  getNextEligibleProcessInstantUtc,
  getWaiverProcessDays,
  isClaimEligibleForProcess,
  isFcfsWindowOpen,
  isWaiverClaimOrderLocked,
  isWaiverProcessDue,
} from "@/lib/leagues/waivers/calendar";
import {
  getDropWaiverClearsAt,
  isEligibleForDailyProcess,
} from "@/lib/leagues/waivers/daily-drops";
import { resolveClaimProcessInstant } from "@/lib/leagues/waivers/claim-schedule";
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
    const wire = { processDays: ["wed"] as WaiverProcessDay[] };
    const justBefore = new Date(Date.UTC(2026, 6, 15, 11, 59, 0));
    const justAfter = new Date(Date.UTC(2026, 6, 15, 12, 0, 0));
    assert.equal(isFcfsWindowOpen(wire, justBefore), false);
    assert.equal(isFcfsWindowOpen(wire, justAfter), true);
  });

  it("keeps weekly FCFS open midweek when daily processing is on", () => {
    const wire = {
      processDays: ["wed"] as WaiverProcessDay[],
      dailyDropProcessing: true,
    };
    // Thursday 11:00 — after Wed +2h, before next Wed
    assert.equal(
      isFcfsWindowOpen(wire, new Date(Date.UTC(2026, 6, 16, 11, 0, 0))),
      true,
    );
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

  it("sets claim deadline one hour before process", () => {
    const processAt = new Date(Date.UTC(2026, 6, 16, 10, 0, 0)); // Thu
    assert.equal(
      getClaimDeadlineForProcess(processAt).toISOString(),
      "2026-07-16T09:00:00.000Z",
    );
  });

  it("includes claims at or before the deadline only", () => {
    const processAt = new Date(Date.UTC(2026, 6, 16, 10, 0, 0));
    assert.equal(
      isClaimEligibleForProcess(
        new Date(Date.UTC(2026, 6, 16, 9, 0, 0)),
        processAt,
      ),
      true,
    );
    assert.equal(
      isClaimEligibleForProcess(
        new Date(Date.UTC(2026, 6, 16, 9, 0, 1)),
        processAt,
      ),
      false,
    );
  });

  it("rolls late claims to the next eligible process day", () => {
    const days = ["wed", "thu", "fri", "sat", "sun", "mon"] as const;
    // After Thu 09:00 deadline → next eligible is Fri 10:00
    const afterThuDeadline = new Date(Date.UTC(2026, 6, 16, 9, 30, 0));
    assert.equal(
      getNextEligibleProcessInstantUtc([...days], afterThuDeadline)?.toISOString(),
      "2026-07-17T10:00:00.000Z",
    );
    // Before Thu 09:00 → still Thursday process
    const beforeThuDeadline = new Date(Date.UTC(2026, 6, 16, 8, 45, 0));
    assert.equal(
      getNextEligibleProcessInstantUtc([...days], beforeThuDeadline)?.toISOString(),
      "2026-07-16T10:00:00.000Z",
    );
  });

  it("formats process instants in UK wall-clock language", () => {
    assert.equal(
      formatWaiverInstantUtc(new Date(Date.UTC(2026, 7, 12, 10, 0, 0))),
      "Wed, 12 Aug at 11am",
    );
    assert.equal(
      formatWaiverInstantUtc(new Date(Date.UTC(2026, 7, 12, 9, 0, 0))),
      "Wed, 12 Aug at 10am",
    );
    assert.equal(
      formatWaiverInstantUtc(new Date(Date.UTC(2026, 0, 14, 10, 0, 0))),
      "Wed, 14 Jan at 10am",
    );
  });

  it("locks claim order from deadline until FCFS opens after weekly process", () => {
    const wire = {
      processDays: ["wed"] as WaiverProcessDay[],
      dailyDropProcessing: false,
    };

    assert.equal(
      isWaiverClaimOrderLocked(wire, new Date(Date.UTC(2026, 7, 12, 8, 30, 0))),
      false,
    );
    assert.equal(
      isWaiverClaimOrderLocked(wire, new Date(Date.UTC(2026, 7, 12, 9, 30, 0))),
      true,
    );
    assert.equal(
      isWaiverClaimOrderLocked(wire, new Date(Date.UTC(2026, 7, 12, 10, 30, 0))),
      true,
    );
    assert.equal(
      isWaiverClaimOrderLocked(wire, new Date(Date.UTC(2026, 7, 12, 12, 30, 0))),
      false,
    );
  });

  it("locks daily runs only until process, not through +2h", () => {
    const wire = {
      processDays: ["wed"] as WaiverProcessDay[],
      dailyDropProcessing: true,
    };
    // Thursday: pre-process lock
    assert.equal(
      isWaiverClaimOrderLocked(wire, new Date(Date.UTC(2026, 6, 16, 9, 30, 0))),
      true,
    );
    // Thursday 10:30 — after daily process, no weekly +2h tail
    assert.equal(
      isWaiverClaimOrderLocked(wire, new Date(Date.UTC(2026, 6, 16, 10, 30, 0))),
      false,
    );
    // Wednesday 10:30 — weekly +2h still applies
    assert.equal(
      isWaiverClaimOrderLocked(wire, new Date(Date.UTC(2026, 6, 15, 10, 30, 0))),
      true,
    );
  });

  it("runs every day when daily drop processing is on", () => {
    assert.deepEqual(
      getWaiverProcessDays({
        processDays: ["wed"],
        dailyDropProcessing: true,
      }),
      ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
    );
    assert.deepEqual(
      getWaiverProcessDays({
        processDays: ["wed"],
        dailyDropProcessing: false,
      }),
      ["wed"],
    );
    assert.equal(
      isWaiverProcessDue({
        processDays: getWaiverProcessDays({
          processDays: ["wed"],
          dailyDropProcessing: true,
        }),
        lastWaiverProcessedAt: new Date(Date.UTC(2026, 6, 15, 10, 0, 0)),
        now: new Date(Date.UTC(2026, 6, 16, 10, 5, 0)),
      }),
      true,
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

  it("unlocks free agents in fantasy preseason when preseason waivers are off", () => {
    assert.equal(
      getAcquisitionKind({
        ...base,
        isFantasyPreseason: true,
        waiverWire: { ...DEFAULT_WAIVER_WIRE_SETTINGS, preseasonWaivers: false },
        now: new Date(Date.UTC(2026, 6, 15, 8, 0, 0)), // before FCFS
        ownership: { fantasyTeamId: null, onWaivers: false },
      }),
      "add",
    );
  });

  it("keeps claim rules in fantasy preseason when preseason waivers are on", () => {
    assert.equal(
      getAcquisitionKind({
        ...base,
        isFantasyPreseason: true,
        waiverWire: { ...DEFAULT_WAIVER_WIRE_SETTINGS, preseasonWaivers: true },
        now: new Date(Date.UTC(2026, 6, 15, 14, 0, 0)), // inside FCFS window
        ownership: { fantasyTeamId: null, onWaivers: false },
      }),
      "claim",
    );
  });

  it("still requires claim for drop waivers in unlocked fantasy preseason", () => {
    assert.equal(
      getAcquisitionKind({
        ...base,
        isFantasyPreseason: true,
        waiverWire: { ...DEFAULT_WAIVER_WIRE_SETTINGS, preseasonWaivers: false },
        ownership: { fantasyTeamId: null, onWaivers: true },
      }),
      "claim",
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

  it("hard-locks players whose NFL game has already started this week", () => {
    assert.equal(
      getAcquisitionKind({
        ...base,
        gameStartedThisWeek: true,
        ownership: { fantasyTeamId: null, onWaivers: false },
      }),
      "unavailable",
    );
    assert.equal(
      getAcquisitionKind({
        ...base,
        gameStartedThisWeek: true,
        ownership: { fantasyTeamId: null, onWaivers: true },
      }),
      "unavailable",
    );
  });

  it("keeps started players claimable when daily drop processing is on", () => {
    assert.equal(
      getAcquisitionKind({
        ...base,
        gameStartedThisWeek: true,
        waiverWire: {
          ...DEFAULT_WAIVER_WIRE_SETTINGS,
          dailyDropProcessing: true,
        },
        ownership: { fantasyTeamId: null, onWaivers: true },
      }),
      "claim",
    );
  });

  it("allows cleared free agents midweek when daily processing is on", () => {
    assert.equal(
      getAcquisitionKind({
        ...base,
        now: new Date(Date.UTC(2026, 6, 16, 14, 0, 0)), // Thu afternoon
        waiverWire: {
          ...DEFAULT_WAIVER_WIRE_SETTINGS,
          dailyDropProcessing: true,
        },
        ownership: { fantasyTeamId: null, onWaivers: false },
      }),
      "add",
    );
  });
});

describe("daily drop routing", () => {
  const dailyWire = {
    ...DEFAULT_WAIVER_WIRE_SETTINGS,
    dailyDropProcessing: true,
    processDays: ["wed"] as WaiverProcessDay[],
  };
  const thursdayAfterProcess = new Date(Date.UTC(2026, 6, 16, 11, 0, 0));
  const fridayProcess = new Date(Date.UTC(2026, 6, 17, 10, 0, 0));
  const sundayKickoff = new Date(Date.UTC(2026, 6, 19, 17, 0, 0));

  it("sends unplayed players to daily when kickoff is after the next run", () => {
    assert.equal(
      isEligibleForDailyProcess({
        kickoff: sundayKickoff,
        processInstant: fridayProcess,
      }),
      true,
    );
  });

  it("sends already-started or same-day kickoffs to the weekly pool", () => {
    assert.equal(
      isEligibleForDailyProcess({
        kickoff: sundayKickoff,
        processInstant: fridayProcess,
        alreadyStarted: true,
      }),
      false,
    );
    assert.equal(
      isEligibleForDailyProcess({
        kickoff: new Date(Date.UTC(2026, 6, 17, 9, 0, 0)),
        processInstant: fridayProcess,
      }),
      false,
    );
  });

  it("treats bye or unknown kickoff as daily", () => {
    assert.equal(
      isEligibleForDailyProcess({
        kickoff: null,
        processInstant: fridayProcess,
      }),
      true,
    );
  });

  it("clears drops on the 24/48 timer even when daily processing is on", () => {
    assert.equal(
      getDropWaiverClearsAt({
        wire: dailyWire,
        now: thursdayAfterProcess,
      }).toISOString(),
      "2026-07-17T11:00:00.000Z",
    );
  });

  it("uses 48 hours when configured", () => {
    assert.equal(
      getDropWaiverClearsAt({
        wire: { ...dailyWire, dropWaiverHours: 48 },
        now: thursdayAfterProcess,
      }).toISOString(),
      "2026-07-18T11:00:00.000Z",
    );
  });

  it("keeps the 24/48 hour timer when daily processing is off", () => {
    assert.equal(
      getDropWaiverClearsAt({
        wire: DEFAULT_WAIVER_WIRE_SETTINGS,
        now: thursdayAfterProcess,
      }).toISOString(),
      "2026-07-17T11:00:00.000Z",
    );
  });
});

describe("adjudicateWaiverClaims", () => {
  const claim = (
    partial: Partial<Parameters<typeof adjudicateWaiverClaims>[0]["claims"][number]> &
      Pick<
        Parameters<typeof adjudicateWaiverClaims>[0]["claims"][number],
        "id" | "teamId" | "playerId" | "sortOrder" | "waiverPriority"
      >,
  ) => ({
    dropPlayerId: null,
    bid: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    faabRemaining: null,
    ...partial,
  });

  it("awards priority to better priority number", () => {
    const result = adjudicateWaiverClaims({
      waiverType: "priority",
      claims: [
        claim({
          id: "c1",
          teamId: "a",
          playerId: "p1",
          sortOrder: 1,
          waiverPriority: 3,
        }),
        claim({
          id: "c2",
          teamId: "b",
          playerId: "p1",
          createdAt: new Date("2026-01-01T01:00:00Z"),
          sortOrder: 1,
          waiverPriority: 1,
        }),
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
        claim({
          id: "c1",
          teamId: "a",
          playerId: "p1",
          bid: 5,
          sortOrder: 1,
          waiverPriority: 1,
          faabRemaining: 100,
        }),
        claim({
          id: "c2",
          teamId: "b",
          playerId: "p1",
          bid: 12,
          createdAt: new Date("2026-01-01T01:00:00Z"),
          sortOrder: 1,
          waiverPriority: 2,
          faabRemaining: 100,
        }),
      ],
    });
    assert.equal(
      result.outcomes.find((row) => row.status === "awarded")?.claimId,
      "c2",
    );
    assert.equal(result.faabSpendByTeam.get("b"), 12);
  });

  it("lets one team win multiple players in claim order under rolling priority", () => {
    const result = adjudicateWaiverClaims({
      waiverType: "priority",
      claims: [
        claim({
          id: "c1",
          teamId: "a",
          playerId: "p1",
          sortOrder: 2,
          waiverPriority: 1,
        }),
        claim({
          id: "c2",
          teamId: "a",
          playerId: "p2",
          createdAt: new Date("2026-01-01T01:00:00Z"),
          sortOrder: 1,
          waiverPriority: 1,
        }),
      ],
    });
    assert.equal(
      result.outcomes.find((row) => row.claimId === "c2")?.status,
      "awarded",
    );
    assert.equal(
      result.outcomes.find((row) => row.claimId === "c1")?.status,
      "awarded",
    );
    assert.deepEqual(result.winnersInOrder, ["a", "a"]);
  });

  it("awards WP1 top claim then cascades contested leftovers (Lions/Darren)", () => {
    // Lions WP1: Jags → Tate → Charbonnet. Darren WP2: Jags only.
    const result = adjudicateWaiverClaims({
      waiverType: "priority",
      claims: [
        claim({
          id: "lions-jags",
          teamId: "lions",
          playerId: "jags",
          sortOrder: 1,
          waiverPriority: 1,
        }),
        claim({
          id: "lions-tate",
          teamId: "lions",
          playerId: "tate",
          createdAt: new Date("2026-01-01T01:00:00Z"),
          sortOrder: 2,
          waiverPriority: 1,
        }),
        claim({
          id: "lions-charb",
          teamId: "lions",
          playerId: "charb",
          createdAt: new Date("2026-01-01T02:00:00Z"),
          sortOrder: 3,
          waiverPriority: 1,
        }),
        claim({
          id: "darren-jags",
          teamId: "darren",
          playerId: "jags",
          createdAt: new Date("2026-01-01T03:00:00Z"),
          sortOrder: 1,
          waiverPriority: 2,
        }),
      ],
    });

    assert.equal(
      result.outcomes.find((row) => row.claimId === "lions-jags")?.status,
      "awarded",
    );
    assert.equal(
      result.outcomes.find((row) => row.claimId === "lions-tate")?.status,
      "awarded",
    );
    assert.equal(
      result.outcomes.find((row) => row.claimId === "lions-charb")?.status,
      "awarded",
    );
    assert.equal(
      result.outcomes.find((row) => row.claimId === "darren-jags")?.status,
      "failed",
    );
    assert.equal(
      result.outcomes.find((row) => row.claimId === "darren-jags")?.failReason,
      "Lower waiver priority.",
    );
    assert.deepEqual(result.winnersInOrder, ["lions", "lions", "lions"]);
  });

  it("gives demoted contested player to next WP when WP1 prefers someone else", () => {
    // WP1 prefers Tate over Jags; WP2 also wants Jags → WP2 must get Jags.
    const result = adjudicateWaiverClaims({
      waiverType: "priority",
      claims: [
        claim({
          id: "lions-tate",
          teamId: "lions",
          playerId: "tate",
          sortOrder: 1,
          waiverPriority: 1,
        }),
        claim({
          id: "lions-jags",
          teamId: "lions",
          playerId: "jags",
          createdAt: new Date("2026-01-01T01:00:00Z"),
          sortOrder: 2,
          waiverPriority: 1,
        }),
        claim({
          id: "darren-jags",
          teamId: "darren",
          playerId: "jags",
          createdAt: new Date("2026-01-01T02:00:00Z"),
          sortOrder: 1,
          waiverPriority: 2,
        }),
      ],
    });

    assert.equal(
      result.outcomes.find((row) => row.claimId === "lions-tate")?.status,
      "awarded",
    );
    assert.equal(
      result.outcomes.find((row) => row.claimId === "darren-jags")?.status,
      "awarded",
    );
    assert.equal(
      result.outcomes.find((row) => row.claimId === "lions-jags")?.status,
      "failed",
    );
    assert.equal(
      result.outcomes.find((row) => row.claimId === "lions-jags")?.failReason,
      "Lower waiver priority.",
    );
    assert.deepEqual(result.winnersInOrder, ["lions", "darren"]);
  });

  it("allows FAAB teams to win multiple players without demotion", () => {
    const result = adjudicateWaiverClaims({
      waiverType: "faab",
      claims: [
        claim({
          id: "c1",
          teamId: "a",
          playerId: "p1",
          bid: 10,
          sortOrder: 1,
          waiverPriority: 1,
          faabRemaining: 100,
        }),
        claim({
          id: "c2",
          teamId: "a",
          playerId: "p2",
          bid: 8,
          createdAt: new Date("2026-01-01T01:00:00Z"),
          sortOrder: 2,
          waiverPriority: 1,
          faabRemaining: 100,
        }),
      ],
    });
    assert.equal(
      result.outcomes.find((row) => row.claimId === "c1")?.status,
      "awarded",
    );
    assert.equal(
      result.outcomes.find((row) => row.claimId === "c2")?.status,
      "awarded",
    );
    assert.equal(result.faabSpendByTeam.get("a"), 18);
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

  it("applies sequential move-to-bottom for multiple awards", () => {
    const next = moveWinnersToBottom(
      [
        { teamId: "a", waiverPriority: 1 },
        { teamId: "b", waiverPriority: 2 },
        { teamId: "c", waiverPriority: 3 },
      ],
      ["a", "b", "a"],
    );
    assert.deepEqual(next, [
      { teamId: "c", waiverPriority: 1 },
      { teamId: "b", waiverPriority: 2 },
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
      "Kings claimed Josh Allen for $12.",
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

describe("claim process schedule", () => {
  it("routes already-kicked-off claims to the weekly process when daily is on", () => {
    const now = new Date(Date.UTC(2026, 6, 16, 12, 0, 0)); // Thu
    const sundayKickoff = new Date(Date.UTC(2026, 6, 12, 17, 0, 0));
    const processAt = resolveClaimProcessInstant({
      wire: { processDays: ["wed"], dailyDropProcessing: true },
      createdAt: new Date(Date.UTC(2026, 6, 13, 12, 0, 0)),
      kickoff: sundayKickoff,
      now,
    });
    assert.equal(processAt?.toISOString(), "2026-07-22T10:00:00.000Z");
  });

  it("keeps unplayed claims on the next daily process", () => {
    const now = new Date(Date.UTC(2026, 6, 16, 8, 0, 0)); // Thu before deadline
    const fridayKickoff = new Date(Date.UTC(2026, 6, 17, 17, 0, 0));
    const processAt = resolveClaimProcessInstant({
      wire: { processDays: ["wed"], dailyDropProcessing: true },
      createdAt: new Date(Date.UTC(2026, 6, 15, 12, 0, 0)),
      kickoff: fridayKickoff,
      now,
    });
    assert.equal(processAt?.toISOString(), "2026-07-16T10:00:00.000Z");
  });
});
