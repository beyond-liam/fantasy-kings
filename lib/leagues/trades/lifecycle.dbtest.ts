import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import { leagueActivity, rosterPlayers, tradePlayers, trades } from "@/db/schema";
import {
  acceptTradeOffer,
  castTradeVeto,
  commitTradeProposal,
  rejectTradeOffer,
  type TradeActor,
  type TradeLeagueRef,
} from "@/lib/leagues/trades/lifecycle";
import { executeTrade } from "@/lib/leagues/trades/execute";
import { DEFAULT_WAIVER_WIRE_SETTINGS } from "@/lib/leagues/waiver-wire";
import { createTestDb, type TestDb } from "@/lib/test/harness";
import {
  seedLeagueSeason,
  seedPlayers,
  seedPositions,
  seedRosterPlayer,
  seedTeams,
} from "@/lib/test/seed";

function leagueRef(leagueId: string, season: { id: string }): TradeLeagueRef {
  return {
    leagueSeasonId: season.id,
    leaguePublicId: `test-league-${leagueId.slice(0, 8)}`,
    leagueName: "Test League",
  };
}

function actorFor(team: { id: string; userId: string; name: string }): TradeActor {
  return { userId: team.userId, teamId: team.id, teamName: team.name };
}

describe("trade lifecycle", () => {
  let testDb: TestDb;

  before(async () => {
    testDb = await createTestDb();
    await seedPositions(testDb);
  });

  it("commitTradeProposal creates a pending trade, offer rows, and a trade_proposed activity row", async () => {
    const { leagueId, season } = await seedLeagueSeason(testDb, { teamCount: 2 });
    const [proposer, receiver] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });
    const [proposerPlayer, receiverPlayer] = await seedPlayers(testDb, [
      { fullName: "Proposer WR", primaryPositionId: "WR" },
      { fullName: "Receiver RB", primaryPositionId: "RB" },
    ]);
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: proposer!.id,
      playerId: proposerPlayer!.id,
    });
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: receiver!.id,
      playerId: receiverPlayer!.id,
    });

    const result = await commitTradeProposal({
      league: leagueRef(leagueId, season),
      actor: actorFor(proposer!),
      receivingTeam: { id: receiver!.id, name: receiver!.name, userId: receiver!.userId },
      proposingOfferIds: [proposerPlayer!.id],
      receivingOfferIds: [receiverPlayer!.id],
      proposingDropIds: [],
      receivingDropIds: [],
      comment: null,
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    const [tradeRow] = await testDb
      .select()
      .from(trades)
      .where(eq(trades.id, result.tradeId));
    assert.equal(tradeRow?.status, "pending");

    const offerRows = await testDb
      .select()
      .from(tradePlayers)
      .where(eq(tradePlayers.tradeId, result.tradeId));
    assert.equal(offerRows.length, 2);

    const activityRows = await testDb
      .select()
      .from(leagueActivity)
      .where(eq(leagueActivity.tradeId, result.tradeId));
    assert.ok(activityRows.some((row) => row.type === "trade_proposed"));
  });

  it("acceptTradeOffer with nextStatus review moves the trade to review without touching rosters", async () => {
    const { leagueId, season } = await seedLeagueSeason(testDb, { teamCount: 2 });
    const [proposer, receiver] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });
    const [proposerPlayer, receiverPlayer] = await seedPlayers(testDb, [
      { fullName: "Review Proposer WR", primaryPositionId: "WR" },
      { fullName: "Review Receiver RB", primaryPositionId: "RB" },
    ]);
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: proposer!.id,
      playerId: proposerPlayer!.id,
    });
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: receiver!.id,
      playerId: receiverPlayer!.id,
    });

    const proposal = await commitTradeProposal({
      league: leagueRef(leagueId, season),
      actor: actorFor(proposer!),
      receivingTeam: { id: receiver!.id, name: receiver!.name, userId: receiver!.userId },
      proposingOfferIds: [proposerPlayer!.id],
      receivingOfferIds: [receiverPlayer!.id],
      proposingDropIds: [],
      receivingDropIds: [],
      comment: null,
    });
    assert.equal(proposal.ok, true);
    if (!proposal.ok) return;

    const reviewEndsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const result = await acceptTradeOffer({
      tradeId: proposal.tradeId,
      proposingTeamId: proposer!.id,
      receivingTeamId: receiver!.id,
      receivingDropIds: [],
      nextStatus: "review",
      reviewEndsAt,
      league: leagueRef(leagueId, season),
      actor: actorFor(receiver!),
      proposingTeam: { name: proposer!.name, userId: proposer!.userId },
      waiversEnabled: true,
      waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
    });

    assert.equal(result.ok, true);

    const [tradeRow] = await testDb
      .select()
      .from(trades)
      .where(eq(trades.id, proposal.tradeId));
    assert.equal(tradeRow?.status, "review");

    const [proposerRoster] = await testDb
      .select()
      .from(rosterPlayers)
      .where(eq(rosterPlayers.playerId, proposerPlayer!.id));
    assert.equal(proposerRoster?.teamId, proposer!.id);
    const [receiverRoster] = await testDb
      .select()
      .from(rosterPlayers)
      .where(eq(rosterPlayers.playerId, receiverPlayer!.id));
    assert.equal(receiverRoster?.teamId, receiver!.id);
  });

  it("executeTrade on a review trade swaps rosters, clears slots, and completes the trade", async () => {
    const { leagueId, season } = await seedLeagueSeason(testDb, { teamCount: 2 });
    const [proposer, receiver] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });
    const [proposerPlayer, receiverPlayer] = await seedPlayers(testDb, [
      { fullName: "Execute Proposer WR", primaryPositionId: "WR" },
      { fullName: "Execute Receiver RB", primaryPositionId: "RB" },
    ]);
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: proposer!.id,
      playerId: proposerPlayer!.id,
      slotPositionId: "WR",
    });
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: receiver!.id,
      playerId: receiverPlayer!.id,
      slotPositionId: "RB",
    });

    const proposal = await commitTradeProposal({
      league: leagueRef(leagueId, season),
      actor: actorFor(proposer!),
      receivingTeam: { id: receiver!.id, name: receiver!.name, userId: receiver!.userId },
      proposingOfferIds: [proposerPlayer!.id],
      receivingOfferIds: [receiverPlayer!.id],
      proposingDropIds: [],
      receivingDropIds: [],
      comment: null,
    });
    assert.equal(proposal.ok, true);
    if (!proposal.ok) return;

    await acceptTradeOffer({
      tradeId: proposal.tradeId,
      proposingTeamId: proposer!.id,
      receivingTeamId: receiver!.id,
      receivingDropIds: [],
      nextStatus: "review",
      reviewEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      league: leagueRef(leagueId, season),
      actor: actorFor(receiver!),
      proposingTeam: { name: proposer!.name, userId: proposer!.userId },
      waiversEnabled: true,
      waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
    });

    const execResult = await executeTrade({
      tradeId: proposal.tradeId,
      waiversEnabled: true,
      waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
    });
    assert.deepEqual(execResult, { success: true });

    const [proposerRoster] = await testDb
      .select()
      .from(rosterPlayers)
      .where(eq(rosterPlayers.playerId, proposerPlayer!.id));
    assert.equal(proposerRoster?.teamId, receiver!.id);
    assert.equal(proposerRoster?.slotPositionId, null);

    const [receiverRoster] = await testDb
      .select()
      .from(rosterPlayers)
      .where(eq(rosterPlayers.playerId, receiverPlayer!.id));
    assert.equal(receiverRoster?.teamId, proposer!.id);
    assert.equal(receiverRoster?.slotPositionId, null);

    const [tradeRow] = await testDb
      .select()
      .from(trades)
      .where(eq(trades.id, proposal.tradeId));
    assert.equal(tradeRow?.status, "completed");
    assert.notEqual(tradeRow?.completedAt, null);
  });

  it("executeTrade is idempotent once a trade has already completed", async () => {
    const { leagueId, season } = await seedLeagueSeason(testDb, { teamCount: 2 });
    const [proposer, receiver] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });
    const [proposerPlayer, receiverPlayer] = await seedPlayers(testDb, [
      { fullName: "Idempotent Proposer WR", primaryPositionId: "WR" },
      { fullName: "Idempotent Receiver RB", primaryPositionId: "RB" },
    ]);
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: proposer!.id,
      playerId: proposerPlayer!.id,
    });
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: receiver!.id,
      playerId: receiverPlayer!.id,
    });

    const proposal = await commitTradeProposal({
      league: leagueRef(leagueId, season),
      actor: actorFor(proposer!),
      receivingTeam: { id: receiver!.id, name: receiver!.name, userId: receiver!.userId },
      proposingOfferIds: [proposerPlayer!.id],
      receivingOfferIds: [receiverPlayer!.id],
      proposingDropIds: [],
      receivingDropIds: [],
      comment: null,
    });
    assert.equal(proposal.ok, true);
    if (!proposal.ok) return;

    await executeTrade({
      tradeId: proposal.tradeId,
      waiversEnabled: true,
      waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
    });

    const activityBefore = await testDb
      .select()
      .from(leagueActivity)
      .where(eq(leagueActivity.tradeId, proposal.tradeId));

    const secondResult = await executeTrade({
      tradeId: proposal.tradeId,
      waiversEnabled: true,
      waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
    });
    assert.deepEqual(secondResult, { success: true });

    const activityAfter = await testDb
      .select()
      .from(leagueActivity)
      .where(eq(leagueActivity.tradeId, proposal.tradeId));
    assert.equal(activityAfter.length, activityBefore.length);
  });

  it("castTradeVeto marks the trade vetoed once the veto threshold is reached", async () => {
    const { leagueId, season } = await seedLeagueSeason(testDb, { teamCount: 4 });
    const [proposer, receiver, voterA, voterB] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 4,
    });
    const [proposerPlayer, receiverPlayer] = await seedPlayers(testDb, [
      { fullName: "Veto Proposer WR", primaryPositionId: "WR" },
      { fullName: "Veto Receiver RB", primaryPositionId: "RB" },
    ]);
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: proposer!.id,
      playerId: proposerPlayer!.id,
    });
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: receiver!.id,
      playerId: receiverPlayer!.id,
    });

    const proposal = await commitTradeProposal({
      league: leagueRef(leagueId, season),
      actor: actorFor(proposer!),
      receivingTeam: { id: receiver!.id, name: receiver!.name, userId: receiver!.userId },
      proposingOfferIds: [proposerPlayer!.id],
      receivingOfferIds: [receiverPlayer!.id],
      proposingDropIds: [],
      receivingDropIds: [],
      comment: null,
    });
    assert.equal(proposal.ok, true);
    if (!proposal.ok) return;

    // Vetoes only apply to trades under review.
    await acceptTradeOffer({
      tradeId: proposal.tradeId,
      proposingTeamId: proposer!.id,
      receivingTeamId: receiver!.id,
      receivingDropIds: [],
      nextStatus: "review",
      reviewEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      league: leagueRef(leagueId, season),
      actor: actorFor(receiver!),
      proposingTeam: { name: proposer!.name, userId: proposer!.userId },
      waiversEnabled: true,
      waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
    });

    // 4 teams -> 2 eligible voters -> threshold floor(2/2)+1 = 2.
    await castTradeVeto({
      tradeId: proposal.tradeId,
      proposingTeamId: proposer!.id,
      receivingTeamId: receiver!.id,
      league: leagueRef(leagueId, season),
      actor: actorFor(voterA!),
      teamCount: 4,
    });

    let [tradeRow] = await testDb
      .select()
      .from(trades)
      .where(eq(trades.id, proposal.tradeId));
    assert.equal(tradeRow?.status, "review");

    await castTradeVeto({
      tradeId: proposal.tradeId,
      proposingTeamId: proposer!.id,
      receivingTeamId: receiver!.id,
      league: leagueRef(leagueId, season),
      actor: actorFor(voterB!),
      teamCount: 4,
    });

    [tradeRow] = await testDb
      .select()
      .from(trades)
      .where(eq(trades.id, proposal.tradeId));
    assert.equal(tradeRow?.status, "vetoed");
  });

  it(
    "acceptTradeOffer never leaves a trade completed when execute fails to find available players",
    async () => {
      const { leagueId, season } = await seedLeagueSeason(testDb, { teamCount: 2 });
      const [proposer, receiver] = await seedTeams(testDb, {
        leagueSeasonId: season.id,
        count: 2,
      });
      const [proposerPlayer, receiverPlayer] = await seedPlayers(testDb, [
        { fullName: "Bug Proposer WR", primaryPositionId: "WR" },
        { fullName: "Bug Receiver RB", primaryPositionId: "RB" },
      ]);
      await seedRosterPlayer(testDb, {
        leagueSeasonId: season.id,
        teamId: proposer!.id,
        playerId: proposerPlayer!.id,
      });
      await seedRosterPlayer(testDb, {
        leagueSeasonId: season.id,
        teamId: receiver!.id,
        playerId: receiverPlayer!.id,
      });

      const proposal = await commitTradeProposal({
        league: leagueRef(leagueId, season),
        actor: actorFor(proposer!),
        receivingTeam: { id: receiver!.id, name: receiver!.name, userId: receiver!.userId },
        proposingOfferIds: [proposerPlayer!.id],
        receivingOfferIds: [receiverPlayer!.id],
        proposingDropIds: [],
        receivingDropIds: [],
        comment: null,
      });
      assert.equal(proposal.ok, true);
      if (!proposal.ok) return;

      // Make the offered player unavailable to the trade so executeTrade fails.
      await testDb
        .update(rosterPlayers)
        .set({ status: "waived" })
        .where(eq(rosterPlayers.playerId, receiverPlayer!.id));

      const result = await acceptTradeOffer({
        tradeId: proposal.tradeId,
        proposingTeamId: proposer!.id,
        receivingTeamId: receiver!.id,
        receivingDropIds: [],
        nextStatus: "completed",
        reviewEndsAt: null,
        league: leagueRef(leagueId, season),
        actor: actorFor(receiver!),
        proposingTeam: { name: proposer!.name, userId: proposer!.userId },
        waiversEnabled: true,
        waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
        rosterSlots: season.settings.rosterSlots,
        benchSlots: season.benchSlots,
      });

      assert.equal(result.ok, false);

      const [tradeRow] = await testDb
        .select()
        .from(trades)
        .where(eq(trades.id, proposal.tradeId));
      // acceptTradeOffer never pre-writes "completed" — executeTrade's atomic
      // claim is the only place that transitions a trade to completed, so a
      // failed execute can only ever leave the trade invalidated (or pending).
      assert.notEqual(tradeRow?.status, "completed");
      assert.equal(tradeRow?.completedAt, null);
      assert.equal(tradeRow?.status, "invalidated");

      const [proposerRoster] = await testDb
        .select()
        .from(rosterPlayers)
        .where(eq(rosterPlayers.playerId, proposerPlayer!.id));
      assert.equal(proposerRoster?.teamId, proposer!.id);
    },
  );

  it("completing one trade invalidates a conflicting pending trade sharing a player", async () => {
    const { leagueId, season } = await seedLeagueSeason(testDb, { teamCount: 3 });
    const [proposer, receiver, thirdParty] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 3,
    });
    const [sharedPlayer, receiverPlayer, thirdPartyPlayer] = await seedPlayers(testDb, [
      { fullName: "Shared WR", primaryPositionId: "WR" },
      { fullName: "Conflict Receiver RB", primaryPositionId: "RB" },
      { fullName: "Conflict Third TE", primaryPositionId: "TE" },
    ]);
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: proposer!.id,
      playerId: sharedPlayer!.id,
    });
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: receiver!.id,
      playerId: receiverPlayer!.id,
    });
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: thirdParty!.id,
      playerId: thirdPartyPlayer!.id,
    });

    const tradeA = await commitTradeProposal({
      league: leagueRef(leagueId, season),
      actor: actorFor(proposer!),
      receivingTeam: { id: receiver!.id, name: receiver!.name, userId: receiver!.userId },
      proposingOfferIds: [sharedPlayer!.id],
      receivingOfferIds: [receiverPlayer!.id],
      proposingDropIds: [],
      receivingDropIds: [],
      comment: null,
    });
    assert.equal(tradeA.ok, true);
    if (!tradeA.ok) return;

    const tradeB = await commitTradeProposal({
      league: leagueRef(leagueId, season),
      actor: actorFor(proposer!),
      receivingTeam: {
        id: thirdParty!.id,
        name: thirdParty!.name,
        userId: thirdParty!.userId,
      },
      proposingOfferIds: [sharedPlayer!.id],
      receivingOfferIds: [thirdPartyPlayer!.id],
      proposingDropIds: [],
      receivingDropIds: [],
      comment: null,
    });
    assert.equal(tradeB.ok, true);
    if (!tradeB.ok) return;

    const execResult = await executeTrade({
      tradeId: tradeA.tradeId,
      waiversEnabled: true,
      waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
    });
    assert.deepEqual(execResult, { success: true });

    const [tradeARow] = await testDb
      .select()
      .from(trades)
      .where(eq(trades.id, tradeA.tradeId));
    assert.equal(tradeARow?.status, "completed");

    const [tradeBRow] = await testDb
      .select()
      .from(trades)
      .where(eq(trades.id, tradeB.tradeId));
    assert.equal(tradeBRow?.status, "invalidated");

    const activityRows = await testDb
      .select()
      .from(leagueActivity)
      .where(eq(leagueActivity.tradeId, tradeB.tradeId));
    assert.ok(activityRows.some((row) => row.type === "trade_cancelled"));
  });

  it("executeTrade fails on a vetoed trade and leaves rosters untouched", async () => {
    const { leagueId, season } = await seedLeagueSeason(testDb, { teamCount: 4 });
    const [proposer, receiver, voterA, voterB] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 4,
    });
    const [proposerPlayer, receiverPlayer] = await seedPlayers(testDb, [
      { fullName: "VetoExec Proposer WR", primaryPositionId: "WR" },
      { fullName: "VetoExec Receiver RB", primaryPositionId: "RB" },
    ]);
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: proposer!.id,
      playerId: proposerPlayer!.id,
    });
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: receiver!.id,
      playerId: receiverPlayer!.id,
    });

    const proposal = await commitTradeProposal({
      league: leagueRef(leagueId, season),
      actor: actorFor(proposer!),
      receivingTeam: { id: receiver!.id, name: receiver!.name, userId: receiver!.userId },
      proposingOfferIds: [proposerPlayer!.id],
      receivingOfferIds: [receiverPlayer!.id],
      proposingDropIds: [],
      receivingDropIds: [],
      comment: null,
    });
    assert.equal(proposal.ok, true);
    if (!proposal.ok) return;

    await acceptTradeOffer({
      tradeId: proposal.tradeId,
      proposingTeamId: proposer!.id,
      receivingTeamId: receiver!.id,
      receivingDropIds: [],
      nextStatus: "review",
      reviewEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      league: leagueRef(leagueId, season),
      actor: actorFor(receiver!),
      proposingTeam: { name: proposer!.name, userId: proposer!.userId },
      waiversEnabled: true,
      waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
    });

    await castTradeVeto({
      tradeId: proposal.tradeId,
      proposingTeamId: proposer!.id,
      receivingTeamId: receiver!.id,
      league: leagueRef(leagueId, season),
      actor: actorFor(voterA!),
      teamCount: 4,
    });
    await castTradeVeto({
      tradeId: proposal.tradeId,
      proposingTeamId: proposer!.id,
      receivingTeamId: receiver!.id,
      league: leagueRef(leagueId, season),
      actor: actorFor(voterB!),
      teamCount: 4,
    });

    const [vetoedRow] = await testDb
      .select()
      .from(trades)
      .where(eq(trades.id, proposal.tradeId));
    assert.equal(vetoedRow?.status, "vetoed");

    const execResult = await executeTrade({
      tradeId: proposal.tradeId,
      waiversEnabled: true,
      waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
    });
    assert.equal(execResult.success, false);

    const [tradeRow] = await testDb
      .select()
      .from(trades)
      .where(eq(trades.id, proposal.tradeId));
    assert.equal(tradeRow?.status, "vetoed");

    const [proposerRoster] = await testDb
      .select()
      .from(rosterPlayers)
      .where(eq(rosterPlayers.playerId, proposerPlayer!.id));
    assert.equal(proposerRoster?.teamId, proposer!.id);
    const [receiverRoster] = await testDb
      .select()
      .from(rosterPlayers)
      .where(eq(rosterPlayers.playerId, receiverPlayer!.id));
    assert.equal(receiverRoster?.teamId, receiver!.id);
  });

  it("castTradeVeto cannot veto a trade that already completed", async () => {
    const { leagueId, season } = await seedLeagueSeason(testDb, { teamCount: 4 });
    const [proposer, receiver, voterA, voterB] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 4,
    });
    const [proposerPlayer, receiverPlayer] = await seedPlayers(testDb, [
      { fullName: "ExecVeto Proposer WR", primaryPositionId: "WR" },
      { fullName: "ExecVeto Receiver RB", primaryPositionId: "RB" },
    ]);
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: proposer!.id,
      playerId: proposerPlayer!.id,
    });
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: receiver!.id,
      playerId: receiverPlayer!.id,
    });

    const proposal = await commitTradeProposal({
      league: leagueRef(leagueId, season),
      actor: actorFor(proposer!),
      receivingTeam: { id: receiver!.id, name: receiver!.name, userId: receiver!.userId },
      proposingOfferIds: [proposerPlayer!.id],
      receivingOfferIds: [receiverPlayer!.id],
      proposingDropIds: [],
      receivingDropIds: [],
      comment: null,
    });
    assert.equal(proposal.ok, true);
    if (!proposal.ok) return;

    await acceptTradeOffer({
      tradeId: proposal.tradeId,
      proposingTeamId: proposer!.id,
      receivingTeamId: receiver!.id,
      receivingDropIds: [],
      nextStatus: "review",
      reviewEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      league: leagueRef(leagueId, season),
      actor: actorFor(receiver!),
      proposingTeam: { name: proposer!.name, userId: proposer!.userId },
      waiversEnabled: true,
      waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
    });

    const execResult = await executeTrade({
      tradeId: proposal.tradeId,
      waiversEnabled: true,
      waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
    });
    assert.deepEqual(execResult, { success: true });

    await castTradeVeto({
      tradeId: proposal.tradeId,
      proposingTeamId: proposer!.id,
      receivingTeamId: receiver!.id,
      league: leagueRef(leagueId, season),
      actor: actorFor(voterA!),
      teamCount: 4,
    });
    await castTradeVeto({
      tradeId: proposal.tradeId,
      proposingTeamId: proposer!.id,
      receivingTeamId: receiver!.id,
      league: leagueRef(leagueId, season),
      actor: actorFor(voterB!),
      teamCount: 4,
    });

    const [tradeRow] = await testDb
      .select()
      .from(trades)
      .where(eq(trades.id, proposal.tradeId));
    assert.equal(tradeRow?.status, "completed");

    const activityRows = await testDb
      .select()
      .from(leagueActivity)
      .where(eq(leagueActivity.tradeId, proposal.tradeId));
    assert.ok(!activityRows.some((row) => row.type === "trade_vetoed"));
  });

  it("a second executeTrade call after completion is a no-op that does not move rosters again", async () => {
    const { leagueId, season } = await seedLeagueSeason(testDb, { teamCount: 2 });
    const [proposer, receiver] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });
    const [proposerPlayer, receiverPlayer] = await seedPlayers(testDb, [
      { fullName: "DoubleExec Proposer WR", primaryPositionId: "WR" },
      { fullName: "DoubleExec Receiver RB", primaryPositionId: "RB" },
    ]);
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: proposer!.id,
      playerId: proposerPlayer!.id,
    });
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: receiver!.id,
      playerId: receiverPlayer!.id,
    });

    const proposal = await commitTradeProposal({
      league: leagueRef(leagueId, season),
      actor: actorFor(proposer!),
      receivingTeam: { id: receiver!.id, name: receiver!.name, userId: receiver!.userId },
      proposingOfferIds: [proposerPlayer!.id],
      receivingOfferIds: [receiverPlayer!.id],
      proposingDropIds: [],
      receivingDropIds: [],
      comment: null,
    });
    assert.equal(proposal.ok, true);
    if (!proposal.ok) return;

    const execArgs = {
      tradeId: proposal.tradeId,
      waiversEnabled: true,
      waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
    };

    const firstResult = await executeTrade(execArgs);
    const secondResult = await executeTrade(execArgs);
    assert.equal(firstResult.success, true);
    assert.equal(secondResult.success, true);

    const proposerRosterRows = await testDb
      .select()
      .from(rosterPlayers)
      .where(eq(rosterPlayers.playerId, proposerPlayer!.id));
    assert.equal(proposerRosterRows.length, 1);
    assert.equal(proposerRosterRows[0]?.teamId, receiver!.id);

    const receiverRosterRows = await testDb
      .select()
      .from(rosterPlayers)
      .where(eq(rosterPlayers.playerId, receiverPlayer!.id));
    assert.equal(receiverRosterRows.length, 1);
    assert.equal(receiverRosterRows[0]?.teamId, proposer!.id);

    const [tradeRow] = await testDb
      .select()
      .from(trades)
      .where(eq(trades.id, proposal.tradeId));
    assert.equal(tradeRow?.status, "completed");
    assert.notEqual(tradeRow?.completedAt, null);
  });

  it("rejectTradeOffer fails once a trade has moved past pending", async () => {
    const { leagueId, season } = await seedLeagueSeason(testDb, { teamCount: 2 });
    const [proposer, receiver] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });
    const [proposerPlayer, receiverPlayer] = await seedPlayers(testDb, [
      { fullName: "ConcurrentAR Proposer WR", primaryPositionId: "WR" },
      { fullName: "ConcurrentAR Receiver RB", primaryPositionId: "RB" },
    ]);
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: proposer!.id,
      playerId: proposerPlayer!.id,
    });
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: receiver!.id,
      playerId: receiverPlayer!.id,
    });

    const proposal = await commitTradeProposal({
      league: leagueRef(leagueId, season),
      actor: actorFor(proposer!),
      receivingTeam: { id: receiver!.id, name: receiver!.name, userId: receiver!.userId },
      proposingOfferIds: [proposerPlayer!.id],
      receivingOfferIds: [receiverPlayer!.id],
      proposingDropIds: [],
      receivingDropIds: [],
      comment: null,
    });
    assert.equal(proposal.ok, true);
    if (!proposal.ok) return;

    const acceptResult = await acceptTradeOffer({
      tradeId: proposal.tradeId,
      proposingTeamId: proposer!.id,
      receivingTeamId: receiver!.id,
      receivingDropIds: [],
      nextStatus: "review",
      reviewEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      league: leagueRef(leagueId, season),
      actor: actorFor(receiver!),
      proposingTeam: { name: proposer!.name, userId: proposer!.userId },
      waiversEnabled: true,
      waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
    });
    assert.equal(acceptResult.ok, true);

    const rejectResult = await rejectTradeOffer({
      tradeId: proposal.tradeId,
      proposingTeamId: proposer!.id,
      league: leagueRef(leagueId, season),
      actor: actorFor(receiver!),
    });
    assert.equal(rejectResult.ok, false);

    const [tradeRow] = await testDb
      .select()
      .from(trades)
      .where(eq(trades.id, proposal.tradeId));
    assert.equal(tradeRow?.status, "review");
  });

  it("executeTrade invalidates a completion that would push a roster over its size limit", async () => {
    const { leagueId, season } = await seedLeagueSeason(testDb, {
      teamCount: 2,
      benchSlots: 0,
    });
    const [proposer, receiver] = await seedTeams(testDb, {
      leagueSeasonId: season.id,
      count: 2,
    });

    const [offerWR, offerTE] = await seedPlayers(testDb, [
      { fullName: "Capacity Offer WR", primaryPositionId: "WR" },
      { fullName: "Capacity Offer TE", primaryPositionId: "TE" },
    ]);
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: proposer!.id,
      playerId: offerWR!.id,
    });
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: proposer!.id,
      playerId: offerTE!.id,
    });

    const [receivingOffer] = await seedPlayers(testDb, [
      { fullName: "Capacity Receiving RB", primaryPositionId: "RB" },
    ]);
    await seedRosterPlayer(testDb, {
      leagueSeasonId: season.id,
      teamId: receiver!.id,
      playerId: receivingOffer!.id,
    });

    // Fill the receiving roster to its active cap (9 starters, 0 bench) so the
    // 2-for-1 trade below pushes it one over.
    const fillers = await seedPlayers(testDb, [
      { fullName: "Filler QB", primaryPositionId: "QB" },
      { fullName: "Filler RB 2", primaryPositionId: "RB" },
      { fullName: "Filler RB 3", primaryPositionId: "RB" },
      { fullName: "Filler WR 1", primaryPositionId: "WR" },
      { fullName: "Filler WR 2", primaryPositionId: "WR" },
      { fullName: "Filler TE", primaryPositionId: "TE" },
      { fullName: "Filler K", primaryPositionId: "K" },
      { fullName: "Filler DEF", primaryPositionId: "DEF" },
    ]);
    for (const filler of fillers) {
      await seedRosterPlayer(testDb, {
        leagueSeasonId: season.id,
        teamId: receiver!.id,
        playerId: filler!.id,
      });
    }

    const proposal = await commitTradeProposal({
      league: leagueRef(leagueId, season),
      actor: actorFor(proposer!),
      receivingTeam: { id: receiver!.id, name: receiver!.name, userId: receiver!.userId },
      proposingOfferIds: [offerWR!.id, offerTE!.id],
      receivingOfferIds: [receivingOffer!.id],
      proposingDropIds: [],
      receivingDropIds: [],
      comment: null,
    });
    assert.equal(proposal.ok, true);
    if (!proposal.ok) return;

    await acceptTradeOffer({
      tradeId: proposal.tradeId,
      proposingTeamId: proposer!.id,
      receivingTeamId: receiver!.id,
      receivingDropIds: [],
      nextStatus: "review",
      reviewEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      league: leagueRef(leagueId, season),
      actor: actorFor(receiver!),
      proposingTeam: { name: proposer!.name, userId: proposer!.userId },
      waiversEnabled: true,
      waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
    });

    const execResult = await executeTrade({
      tradeId: proposal.tradeId,
      waiversEnabled: true,
      waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
    });
    assert.equal(execResult.success, false);
    assert.equal((execResult as { invalidated?: boolean }).invalidated, true);

    const [tradeRow] = await testDb
      .select()
      .from(trades)
      .where(eq(trades.id, proposal.tradeId));
    assert.equal(tradeRow?.status, "invalidated");

    const [proposerRosterRow] = await testDb
      .select()
      .from(rosterPlayers)
      .where(eq(rosterPlayers.playerId, offerWR!.id));
    assert.equal(proposerRosterRow?.teamId, proposer!.id);

    const [receivingRosterRow] = await testDb
      .select()
      .from(rosterPlayers)
      .where(eq(rosterPlayers.playerId, receivingOffer!.id));
    assert.equal(receivingRosterRow?.teamId, receiver!.id);
  });
});
