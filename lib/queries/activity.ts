import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";

import {
  leagueActivity,
  leagueMembers,
  players,
  teams,
  waiverClaims,
} from "@/db/schema";
import type { LeagueActivityMetadata } from "@/db/schema/league-activity";
import { db } from "@/lib/db";
import {
  FEED_ACTIVITY_TYPES,
  type FeedActivityType,
} from "@/lib/leagues/activity-log";

/**
 * Same-timestamp companion rows: acquisition first, then IR/Taxi placement,
 * then drops (feed is newest-first by createdAt).
 */
const ACTIVITY_FEED_TYPE_PRIORITY = sql`
  case ${leagueActivity.type}
    when 'waiver_awarded' then 0
    when 'player_added' then 0
    when 'ir_added' then 1
    when 'taxi_added' then 1
    when 'player_dropped' then 2
    else 3
  end
`;

export type LeagueActivityRow = {
  id: string;
  type: FeedActivityType;
  summary: string;
  createdAt: Date;
  teamId: string | null;
  teamName: string | null;
  playerId: string | null;
  playerName: string | null;
  tradeId: string | null;
  metadata: LeagueActivityMetadata | null;
};

export async function getLeagueActivity(
  leagueSeasonId: string,
  limit = 100,
): Promise<LeagueActivityRow[]> {
  const rows = await db
    .select({
      id: leagueActivity.id,
      type: leagueActivity.type,
      summary: leagueActivity.summary,
      createdAt: leagueActivity.createdAt,
      teamId: leagueActivity.teamId,
      teamName: teams.name,
      playerId: leagueActivity.playerId,
      playerName: players.fullName,
      tradeId: leagueActivity.tradeId,
      metadata: leagueActivity.metadata,
    })
    .from(leagueActivity)
    .leftJoin(teams, eq(leagueActivity.teamId, teams.id))
    .leftJoin(players, eq(leagueActivity.playerId, players.id))
    .where(
      and(
        eq(leagueActivity.leagueSeasonId, leagueSeasonId),
        inArray(leagueActivity.type, [...FEED_ACTIVITY_TYPES]),
      ),
    )
    .orderBy(
      desc(leagueActivity.createdAt),
      asc(ACTIVITY_FEED_TYPE_PRIORITY),
      desc(leagueActivity.id),
    )
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    type: row.type as FeedActivityType,
    metadata: row.metadata ?? null,
  }));
}

export type UnseenWaiverResult = {
  id: string;
  status: "awarded" | "failed";
  playerId: string;
  playerName: string;
  dropPlayerId: string | null;
  dropPlayerName: string | null;
  bid: number | null;
  failReason: string | null;
  processedAt: Date;
};

export async function getUnseenTeamWaiverResults(input: {
  teamId: string;
  lastSeenAt: Date | null;
}): Promise<UnseenWaiverResult[]> {
  const baseRows = await db
    .select({
      id: waiverClaims.id,
      status: waiverClaims.status,
      playerId: waiverClaims.playerId,
      playerName: players.fullName,
      dropPlayerId: waiverClaims.dropPlayerId,
      bid: waiverClaims.bid,
      failReason: waiverClaims.failReason,
      processedAt: waiverClaims.processedAt,
    })
    .from(waiverClaims)
    .innerJoin(players, eq(waiverClaims.playerId, players.id))
    .where(
      and(
        eq(waiverClaims.teamId, input.teamId),
        inArray(waiverClaims.status, ["awarded", "failed"]),
      ),
    )
    .orderBy(desc(waiverClaims.processedAt));

  const processed = baseRows.filter(
    (row): row is typeof row & { processedAt: Date; status: "awarded" | "failed" } =>
      row.processedAt != null &&
      (row.status === "awarded" || row.status === "failed"),
  );

  if (processed.length === 0) {
    return [];
  }

  let rows = processed;
  if (input.lastSeenAt) {
    rows = processed.filter((row) => row.processedAt > input.lastSeenAt!);
  } else {
    // First visit: only the most recent process batch for this team.
    const latestMs = processed[0]!.processedAt.getTime();
    rows = processed.filter(
      (row) => Math.abs(row.processedAt.getTime() - latestMs) < 60_000,
    );
  }

  if (rows.length === 0) {
    return [];
  }

  const dropIds = rows
    .map((row) => row.dropPlayerId)
    .filter((id): id is string => Boolean(id));
  const dropNames = new Map<string, string>();
  if (dropIds.length > 0) {
    const dropRows = await db
      .select({ id: players.id, fullName: players.fullName })
      .from(players)
      .where(inArray(players.id, dropIds));
    for (const row of dropRows) {
      dropNames.set(row.id, row.fullName);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    playerId: row.playerId,
    playerName: row.playerName,
    dropPlayerId: row.dropPlayerId,
    dropPlayerName: row.dropPlayerId
      ? (dropNames.get(row.dropPlayerId) ?? null)
      : null,
    bid: row.bid,
    failReason: row.failReason,
    processedAt: row.processedAt,
  }));
}

export async function getActivityNavIndicator(input: {
  leagueId: string;
  leagueSeasonId: string;
  userId: string;
}): Promise<{ showDot: boolean }> {
  const [member] = await db
    .select({ lastActivitySeenAt: leagueMembers.lastActivitySeenAt })
    .from(leagueMembers)
    .where(
      and(
        eq(leagueMembers.leagueId, input.leagueId),
        eq(leagueMembers.userId, input.userId),
      ),
    )
    .limit(1);

  if (!member) {
    return { showDot: false };
  }

  const unseen = [
    eq(leagueActivity.leagueSeasonId, input.leagueSeasonId),
    inArray(leagueActivity.type, [...FEED_ACTIVITY_TYPES]),
    ...(member.lastActivitySeenAt
      ? [gt(leagueActivity.createdAt, member.lastActivitySeenAt)]
      : []),
  ];

  const [row] = await db
    .select({ id: leagueActivity.id })
    .from(leagueActivity)
    .where(and(...unseen))
    .limit(1);

  return { showDot: Boolean(row) };
}

export async function markLeagueActivitySeen(input: {
  leagueId: string;
  userId: string;
  seenAt?: Date;
}) {
  await db
    .update(leagueMembers)
    .set({ lastActivitySeenAt: input.seenAt ?? new Date() })
    .where(
      and(
        eq(leagueMembers.leagueId, input.leagueId),
        eq(leagueMembers.userId, input.userId),
      ),
    );
}
