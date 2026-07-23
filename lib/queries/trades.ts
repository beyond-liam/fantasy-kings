import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cache } from "react";

import {
  draftPicks,
  playerExternalIds,
  players,
  rosterPlayers,
  teams,
  tradePlayers,
  tradeVetoes,
  trades,
} from "@/db/schema";
import { db } from "@/lib/db";
import { rosterPositionSortIndex } from "@/lib/leagues/roster-position-order";
import { formatAcquisitionLabel } from "@/lib/leagues/trades/acquisition-label";
import { OPEN_TRADE_STATUSES } from "@/lib/leagues/trades/guards";
import type { TradeRosterPlayer } from "@/lib/leagues/trades/validate";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import { getRankedPlayers } from "@/lib/queries/players";
import { getTeamRosterPlayers } from "@/lib/queries/team-roster";

const proposingTeam = alias(teams, "proposing_team");
const receivingTeam = alias(teams, "receiving_team");

/** Full projection pool ranks — shared across both trade roster fetches. */
const getProjectionPositionRanks = cache(
  async (
    seasonYear: string,
    scoringRulesKey: string,
  ): Promise<Map<string, number | null>> => {
    const scoringRules = JSON.parse(
      scoringRulesKey,
    ) as ScoringRuleDefinition[];
    const ranked = await getRankedPlayers({
      season: seasonYear,
      week: 0,
      kind: "projection",
      scoringRules,
    }).catch(() => []);

    return new Map(ranked.map((player) => [player.id, player.positionRank]));
  },
);

export type TradePlayerRow = {
  id: string;
  fullName: string;
  nflTeam: string | null;
  primaryPositionId: string;
  slotPositionId: string | null;
  sleeperId: string | null;
  acquisitionLabel: string;
  positionRank: number | null;
  fantasyPts: number | null;
  avgPts: number | null;
  locked: boolean;
};

export type TradeListPlayer = {
  playerId: string;
  playerName: string;
  nflTeam: string | null;
  primaryPositionId: string;
  sleeperId: string | null;
  teamId: string;
  isDrop: boolean;
};

export type TradeListRow = {
  id: string;
  status: string;
  comment: string | null;
  reviewEndsAt: Date | null;
  createdAt: Date;
  proposingTeamId: string;
  proposingTeamName: string;
  proposingTeamSlug: string;
  receivingTeamId: string;
  receivingTeamName: string;
  receivingTeamSlug: string;
  createdByUserId: string | null;
  players: TradeListPlayer[];
};

async function getDraftRoundMap(teamIds: string[]) {
  if (teamIds.length === 0) {
    return new Map<string, { round: number | null; wasDrafted: boolean }>();
  }

  const rows = await db
    .select({
      teamId: draftPicks.teamId,
      playerId: draftPicks.playerId,
      round: draftPicks.round,
    })
    .from(draftPicks)
    .where(inArray(draftPicks.teamId, teamIds));

  const map = new Map<string, { round: number | null; wasDrafted: boolean }>();
  for (const row of rows) {
    map.set(`${row.teamId}:${row.playerId}`, {
      round: row.round,
      wasDrafted: true,
    });
  }
  return map;
}

export async function getTradeComposerRoster(input: {
  teamId: string;
  seasonYear: string;
  scoringRules: ScoringRuleDefinition[];
}): Promise<TradePlayerRow[]> {
  const scoringRulesKey = JSON.stringify(input.scoringRules);
  const [roster, draftMap, rankById] = await Promise.all([
    getTeamRosterPlayers(input.teamId),
    getDraftRoundMap([input.teamId]),
    getProjectionPositionRanks(input.seasonYear, scoringRulesKey),
  ]);

  const rows: TradePlayerRow[] = roster.map((player) => {
    const draft = draftMap.get(`${input.teamId}:${player.id}`);
    const acquisitionLabel = formatAcquisitionLabel({
      draftRound: draft?.round ?? null,
      wasDrafted: draft?.wasDrafted ?? false,
    });

    return {
      id: player.id,
      fullName: player.fullName,
      nflTeam: player.nflTeam,
      primaryPositionId: player.primaryPositionId,
      slotPositionId: player.slotPositionId,
      sleeperId: player.sleeperId,
      acquisitionLabel,
      positionRank: rankById.get(player.id) ?? null,
      // Season scoring starts blank until games have been played.
      fantasyPts: null,
      avgPts: null,
      locked: false,
    };
  });

  return rows.toSorted((a, b) => {
    const positionDiff =
      rosterPositionSortIndex(a.primaryPositionId) -
      rosterPositionSortIndex(b.primaryPositionId);
    if (positionDiff !== 0) {
      return positionDiff;
    }

    const aRank = a.positionRank ?? Number.POSITIVE_INFINITY;
    const bRank = b.positionRank ?? Number.POSITIVE_INFINITY;
    if (aRank !== bRank) {
      return aRank - bRank;
    }

    return a.fullName.localeCompare(b.fullName);
  });
}

export async function toTradeRosterPlayers(
  teamId: string,
): Promise<TradeRosterPlayer[]> {
  const roster = await getTeamRosterPlayers(teamId);
  return roster.map((player) => ({
    id: player.id,
    slotPositionId: player.slotPositionId,
    primaryPositionId: player.primaryPositionId,
  }));
}

async function hydrateTradePlayers(tradeIds: string[]) {
  if (tradeIds.length === 0) {
    return new Map<string, TradeListPlayer[]>();
  }

  const rows = await db
    .select({
      tradeId: tradePlayers.tradeId,
      playerId: tradePlayers.playerId,
      playerName: players.fullName,
      nflTeam: players.nflTeam,
      primaryPositionId: players.primaryPositionId,
      sleeperId: playerExternalIds.externalId,
      teamId: tradePlayers.teamId,
      isDrop: tradePlayers.isDrop,
    })
    .from(tradePlayers)
    .innerJoin(players, eq(tradePlayers.playerId, players.id))
    .leftJoin(
      playerExternalIds,
      and(
        eq(playerExternalIds.playerId, players.id),
        eq(playerExternalIds.provider, "sleeper"),
      ),
    )
    .where(inArray(tradePlayers.tradeId, tradeIds));

  const map = new Map<string, TradeListPlayer[]>();
  for (const row of rows) {
    const list = map.get(row.tradeId) ?? [];
    list.push({
      playerId: row.playerId,
      playerName: row.playerName,
      nflTeam: row.nflTeam,
      primaryPositionId: row.primaryPositionId,
      sleeperId: row.sleeperId,
      teamId: row.teamId,
      isDrop: row.isDrop,
    });
    map.set(row.tradeId, list);
  }
  return map;
}

export async function getLeagueTrades(
  leagueSeasonId: string,
  teamId?: string,
): Promise<TradeListRow[]> {
  const conditions = [eq(trades.leagueSeasonId, leagueSeasonId)];
  if (teamId) {
    conditions.push(
      or(
        eq(trades.proposingTeamId, teamId),
        eq(trades.receivingTeamId, teamId),
      )!,
    );
  }

  const rows = await db
    .select({
      id: trades.id,
      status: trades.status,
      comment: trades.comment,
      reviewEndsAt: trades.reviewEndsAt,
      createdAt: trades.createdAt,
      proposingTeamId: trades.proposingTeamId,
      receivingTeamId: trades.receivingTeamId,
      createdByUserId: trades.createdByUserId,
      proposingTeamName: proposingTeam.name,
      proposingTeamSlug: proposingTeam.slug,
      receivingTeamName: receivingTeam.name,
      receivingTeamSlug: receivingTeam.slug,
    })
    .from(trades)
    .innerJoin(proposingTeam, eq(trades.proposingTeamId, proposingTeam.id))
    .innerJoin(receivingTeam, eq(trades.receivingTeamId, receivingTeam.id))
    .where(and(...conditions))
    .orderBy(desc(trades.createdAt));

  const playersByTrade = await hydrateTradePlayers(rows.map((row) => row.id));

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    comment: row.comment,
    reviewEndsAt: row.reviewEndsAt,
    createdAt: row.createdAt,
    proposingTeamId: row.proposingTeamId,
    proposingTeamName: row.proposingTeamName,
    proposingTeamSlug: row.proposingTeamSlug ?? row.proposingTeamId,
    receivingTeamId: row.receivingTeamId,
    receivingTeamName: row.receivingTeamName,
    receivingTeamSlug: row.receivingTeamSlug ?? row.receivingTeamId,
    createdByUserId: row.createdByUserId,
    players: playersByTrade.get(row.id) ?? [],
  }));
}

/** Trades that involve this team as proposer or receiver only. */
export async function getTeamTrades(leagueSeasonId: string, teamId: string) {
  return getLeagueTrades(leagueSeasonId, teamId);
}

export async function getTeamOpenTrades(teamId: string) {
  const rows = await db
    .select({ id: trades.id })
    .from(trades)
    .where(
      and(
        or(
          eq(trades.proposingTeamId, teamId),
          eq(trades.receivingTeamId, teamId),
        ),
        inArray(trades.status, [...OPEN_TRADE_STATUSES]),
      ),
    );
  return rows.length;
}

export async function getIncomingTradeActionCount(teamId: string) {
  const rows = await db
    .select({ id: trades.id })
    .from(trades)
    .where(
      and(
        eq(trades.receivingTeamId, teamId),
        eq(trades.status, "pending"),
      ),
    );
  return rows.length;
}

export async function getCommissionerPendingTradeCount(leagueSeasonId: string) {
  const rows = await db
    .select({ id: trades.id })
    .from(trades)
    .where(
      and(
        eq(trades.leagueSeasonId, leagueSeasonId),
        eq(trades.status, "awaiting_commissioner"),
      ),
    );
  return rows.length;
}

export async function getTradeNavIndicator(input: {
  leagueSeasonId: string;
  teamId: string | null;
  isCommissioner: boolean;
  tradeProcessing: string;
}) {
  let showDot = false;

  if (input.teamId) {
    const involved = await getTeamOpenTrades(input.teamId);
    if (involved > 0) {
      showDot = true;
    }
  }

  if (
    input.isCommissioner &&
    input.tradeProcessing === "commissioner"
  ) {
    const pending = await getCommissionerPendingTradeCount(
      input.leagueSeasonId,
    );
    if (pending > 0) {
      showDot = true;
    }
  }

  return { showDot };
}

export async function getTradeById(tradeId: string) {
  const [row] = await db
    .select()
    .from(trades)
    .where(eq(trades.id, tradeId))
    .limit(1);
  return row ?? null;
}

export async function getExpiredReviewTrades(leagueSeasonId?: string) {
  const conditions = [
    eq(trades.status, "review"),
    sql`${trades.reviewEndsAt} <= now()`,
  ];
  if (leagueSeasonId) {
    conditions.push(eq(trades.leagueSeasonId, leagueSeasonId));
  }

  return db
    .select({
      id: trades.id,
      leagueSeasonId: trades.leagueSeasonId,
    })
    .from(trades)
    .where(and(...conditions));
}

export type TradeVetoSummary = {
  tradeId: string;
  count: number;
  threshold: number;
  myTeamVetoed: boolean;
};

export async function getTradeVetoSummaries(input: {
  tradeIds: string[];
  leagueSeasonId: string;
  myTeamId: string | null;
}) {
  if (input.tradeIds.length === 0) {
    return new Map<string, TradeVetoSummary>();
  }

  const [teamCountRow, vetoRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(teams)
      .where(eq(teams.leagueSeasonId, input.leagueSeasonId))
      .then((rows) => rows[0]),
    db
      .select({
        tradeId: tradeVetoes.tradeId,
        teamId: tradeVetoes.teamId,
      })
      .from(tradeVetoes)
      .where(inArray(tradeVetoes.tradeId, input.tradeIds)),
  ]);

  const totalTeams = teamCountRow?.count ?? 0;
  const eligible = Math.max(0, totalTeams - 2);
  const threshold = eligible <= 0 ? 1 : Math.floor(eligible / 2) + 1;

  const counts = new Map<string, number>();
  const myVetoes = new Set<string>();

  for (const row of vetoRows) {
    counts.set(row.tradeId, (counts.get(row.tradeId) ?? 0) + 1);
    if (input.myTeamId && row.teamId === input.myTeamId) {
      myVetoes.add(row.tradeId);
    }
  }

  const map = new Map<string, TradeVetoSummary>();
  for (const tradeId of input.tradeIds) {
    map.set(tradeId, {
      tradeId,
      count: counts.get(tradeId) ?? 0,
      threshold,
      myTeamVetoed: myVetoes.has(tradeId),
    });
  }

  return map;
}

export async function listRosterPlayerRows(teamId: string, playerIds: string[]) {
  if (playerIds.length === 0) {
    return [];
  }
  return db
    .select({
      id: rosterPlayers.id,
      playerId: rosterPlayers.playerId,
      teamId: rosterPlayers.teamId,
      slotPositionId: rosterPlayers.slotPositionId,
      status: rosterPlayers.status,
      fullName: players.fullName,
      primaryPositionId: players.primaryPositionId,
      nflTeam: players.nflTeam,
    })
    .from(rosterPlayers)
    .innerJoin(players, eq(rosterPlayers.playerId, players.id))
    .where(
      and(
        eq(rosterPlayers.teamId, teamId),
        inArray(rosterPlayers.playerId, playerIds),
        eq(rosterPlayers.status, "rostered"),
      ),
    );
}
