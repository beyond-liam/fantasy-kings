import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { eq } from "drizzle-orm";

import { leagueActivity, rosterPlayers, tradePlayers, trades } from "@/db/schema";
import {
  acceptTradeOffer,
  castTradeVeto,
  commitTradeProposal,
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
    });

    const execResult = await executeTrade({
      tradeId: proposal.tradeId,
      waiversEnabled: true,
      waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
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
    });

    const activityBefore = await testDb
      .select()
      .from(leagueActivity)
      .where(eq(leagueActivity.tradeId, proposal.tradeId));

    const secondResult = await executeTrade({
      tradeId: proposal.tradeId,
      waiversEnabled: true,
      waiverWire: DEFAULT_WAIVER_WIRE_SETTINGS,
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
    assert.equal(tradeRow?.status, "pending");

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
    "CHARACTERIZATION OF KNOWN BUG — plan 011 flips this: status must not be completed when execute fails.",
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
      });

      assert.equal(result.ok, false);

      const [tradeRow] = await testDb
        .select()
        .from(trades)
        .where(eq(trades.id, proposal.tradeId));
      // acceptTradeOffer writes status: "completed" unconditionally before calling
      // executeTrade; executeTrade's own failure path here happens to overwrite it
      // to "invalidated", but that overwrite is itself an uncoordinated second write
      // racing the first — nothing prevents the "completed" write from winning.
      assert.equal(tradeRow?.status, "invalidated");
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
});
