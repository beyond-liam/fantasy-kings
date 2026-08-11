import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canProposeTrades,
  isLeagueVisibleTradeStatus,
  isTradeDeadlineLockout,
  isTradeVisibleToTeam,
} from "@/lib/leagues/trades/guards";

describe("canProposeTrades", () => {
  const base = {
    tradesEnabled: true,
    settings: {},
  };

  it("allows trades during draft", () => {
    assert.deepEqual(canProposeTrades({ ...base, status: "draft" }), {
      ok: true,
    });
  });

  it("allows trades while the season is active", () => {
    assert.deepEqual(canProposeTrades({ ...base, status: "active" }), {
      ok: true,
    });
  });

  it("blocks when trades are disabled", () => {
    assert.equal(
      canProposeTrades({ ...base, status: "draft", tradesEnabled: false }).ok,
      false,
    );
  });

  it("blocks after the season unless permitTradesAfterSeason", () => {
    assert.equal(
      canProposeTrades({ ...base, status: "completed" }).ok,
      false,
    );
    assert.deepEqual(
      canProposeTrades({
        ...base,
        status: "completed",
        settings: { transactionRules: { permitTradesAfterSeason: true } },
      }),
      { ok: true },
    );
  });
});

describe("isTradeDeadlineLockout", () => {
  it("is open before and during the deadline week", () => {
    assert.equal(
      isTradeDeadlineLockout({
        currentWeek: 10,
        deadlineWeek: 11,
        lastGameWeek: 17,
      }),
      false,
    );
    assert.equal(
      isTradeDeadlineLockout({
        currentWeek: 11,
        deadlineWeek: 11,
        lastGameWeek: 17,
      }),
      false,
    );
  });

  it("locks from after the deadline through the last game week", () => {
    assert.equal(
      isTradeDeadlineLockout({
        currentWeek: 12,
        deadlineWeek: 11,
        lastGameWeek: 17,
      }),
      true,
    );
    assert.equal(
      isTradeDeadlineLockout({
        currentWeek: 17,
        deadlineWeek: 11,
        lastGameWeek: 17,
      }),
      true,
    );
  });

  it("reopens after the last game week", () => {
    assert.equal(
      isTradeDeadlineLockout({
        currentWeek: 18,
        deadlineWeek: 11,
        lastGameWeek: 17,
      }),
      false,
    );
  });

  it("does nothing when there is no deadline", () => {
    assert.equal(
      isTradeDeadlineLockout({
        currentWeek: 15,
        deadlineWeek: null,
        lastGameWeek: 17,
      }),
      false,
    );
  });
});

describe("trade league visibility", () => {
  const pending = {
    status: "pending",
    proposingTeamId: "a",
    receivingTeamId: "b",
  };

  it("hides pending from uninvolved teams", () => {
    assert.equal(isLeagueVisibleTradeStatus("pending"), false);
    assert.equal(isTradeVisibleToTeam(pending, "c"), false);
  });

  it("shows pending to involved teams", () => {
    assert.equal(isTradeVisibleToTeam(pending, "a"), true);
    assert.equal(isTradeVisibleToTeam(pending, "b"), true);
  });

  it("shows accepted and later statuses to the whole league", () => {
    assert.equal(isLeagueVisibleTradeStatus("review"), true);
    assert.equal(isLeagueVisibleTradeStatus("completed"), true);
    assert.equal(
      isTradeVisibleToTeam({ ...pending, status: "review" }, "c"),
      true,
    );
  });

  it("keeps rejected and cancelled private", () => {
    assert.equal(isLeagueVisibleTradeStatus("rejected"), false);
    assert.equal(isLeagueVisibleTradeStatus("cancelled"), false);
    assert.equal(
      isTradeVisibleToTeam({ ...pending, status: "rejected" }, "c"),
      false,
    );
  });
});
