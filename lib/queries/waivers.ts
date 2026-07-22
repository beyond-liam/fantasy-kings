import { and, asc, eq, inArray } from "drizzle-orm";

import { playerExternalIds, players, teams, waiverClaims } from "@/db/schema";
import { db } from "@/lib/db";

export type PendingWaiverClaimRow = {
  id: string;
  playerId: string;
  playerName: string;
  nflTeam: string | null;
  primaryPositionId: string;
  sleeperId: string | null;
  dropPlayerId: string | null;
  dropPlayerName: string | null;
  bid: number | null;
  sortOrder: number;
  createdAt: Date;
  teamId: string;
  teamName: string;
};

export async function getTeamPendingWaiverClaims(
  teamId: string,
): Promise<PendingWaiverClaimRow[]> {
  const rows = await db
    .select({
      id: waiverClaims.id,
      playerId: waiverClaims.playerId,
      playerName: players.fullName,
      nflTeam: players.nflTeam,
      primaryPositionId: players.primaryPositionId,
      sleeperId: playerExternalIds.externalId,
      dropPlayerId: waiverClaims.dropPlayerId,
      bid: waiverClaims.bid,
      sortOrder: waiverClaims.sortOrder,
      createdAt: waiverClaims.createdAt,
      teamId: waiverClaims.teamId,
      teamName: teams.name,
    })
    .from(waiverClaims)
    .innerJoin(players, eq(waiverClaims.playerId, players.id))
    .leftJoin(
      playerExternalIds,
      and(
        eq(playerExternalIds.playerId, players.id),
        eq(playerExternalIds.provider, "sleeper"),
      ),
    )
    .innerJoin(teams, eq(waiverClaims.teamId, teams.id))
    .where(
      and(eq(waiverClaims.teamId, teamId), eq(waiverClaims.status, "pending")),
    )
    .orderBy(asc(waiverClaims.sortOrder), asc(waiverClaims.createdAt));

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
    ...row,
    dropPlayerName: row.dropPlayerId
      ? (dropNames.get(row.dropPlayerId) ?? null)
      : null,
  }));
}

export async function getSeasonPendingClaimCount(leagueSeasonId: string) {
  const rows = await db
    .select({ id: waiverClaims.id })
    .from(waiverClaims)
    .where(
      and(
        eq(waiverClaims.leagueSeasonId, leagueSeasonId),
        eq(waiverClaims.status, "pending"),
      ),
    );
  return rows.length;
}

export async function getTeamPendingClaimPlayerIds(
  teamId: string,
): Promise<string[]> {
  const rows = await db
    .select({ playerId: waiverClaims.playerId })
    .from(waiverClaims)
    .where(
      and(eq(waiverClaims.teamId, teamId), eq(waiverClaims.status, "pending")),
    );
  return rows.map((row) => row.playerId);
}

