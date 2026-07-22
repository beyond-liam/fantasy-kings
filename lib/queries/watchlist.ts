import { and, asc, eq } from "drizzle-orm";
import { cache } from "react";

import { playerExternalIds, players, teamWatchlist, teams } from "@/db/schema";
import { db } from "@/lib/db";
import type { PlayerOpponent } from "@/lib/nfl/matchups";
import {
  getLeagueBySlug,
  getLeagueMembership,
  getLeagueSeason,
} from "@/lib/queries/leagues";

export type WatchlistPlayer = {
  id: string;
  fullName: string;
  nflTeam: string | null;
  primaryPositionId: string;
  byeWeek: number | null;
  injuryStatus: string | null;
  sleeperId: string | null;
  addedAt: Date;
  fantasyTeamId?: string | null;
  fantasyTeamName?: string | null;
  isOwnedByCurrentUser?: boolean;
  onWaivers?: boolean;
  acquisitionKind?: "add" | "claim" | "owned" | "unavailable";
  hasPendingClaim?: boolean;
  ownedPct?: number | null;
  startPct?: number | null;
  opponent?: PlayerOpponent | null;
  actualPts?: number | null;
  projectedPts?: number | null;
};

export const getUserTeamForSeason = cache(
  async (leagueSeasonId: string, userId: string) => {
    const [team] = await db
      .select()
      .from(teams)
      .where(
        and(
          eq(teams.leagueSeasonId, leagueSeasonId),
          eq(teams.userId, userId),
        ),
      )
      .limit(1);

    return team ?? null;
  },
);

export async function getUserTeamForLeague(slug: string, userId: string) {
  const league = await getLeagueBySlug(slug);
  if (!league) {
    return null;
  }

  const membership = await getLeagueMembership(league.id, userId);
  if (!membership) {
    return null;
  }

  const season = await getLeagueSeason(league.id);
  if (!season) {
    return null;
  }

  return getUserTeamForSeason(season.id, userId);
}

export async function getTeamWatchlistPlayerIds(teamId: string) {
  const rows = await db
    .select({ playerId: teamWatchlist.playerId })
    .from(teamWatchlist)
    .where(eq(teamWatchlist.teamId, teamId));

  return rows.map((row) => row.playerId);
}

export async function getTeamWatchlist(
  teamId: string,
): Promise<WatchlistPlayer[]> {
  return db
    .select({
      id: players.id,
      fullName: players.fullName,
      nflTeam: players.nflTeam,
      primaryPositionId: players.primaryPositionId,
      byeWeek: players.byeWeek,
      injuryStatus: players.injuryStatus,
      sleeperId: playerExternalIds.externalId,
      addedAt: teamWatchlist.createdAt,
    })
    .from(teamWatchlist)
    .innerJoin(players, eq(teamWatchlist.playerId, players.id))
    .leftJoin(
      playerExternalIds,
      and(
        eq(playerExternalIds.playerId, players.id),
        eq(playerExternalIds.provider, "sleeper"),
      ),
    )
    .where(eq(teamWatchlist.teamId, teamId))
    .orderBy(asc(teamWatchlist.createdAt));
}

export async function getSeasonWatchlistPlayerIds(
  leagueSeasonId: string,
  userId: string,
) {
  const team = await getUserTeamForSeason(leagueSeasonId, userId);
  if (!team) {
    return [];
  }

  return getTeamWatchlistPlayerIds(team.id);
}

export async function getLeagueWatchlistPlayerIds(slug: string, userId: string) {
  const team = await getUserTeamForLeague(slug, userId);
  if (!team) {
    return [];
  }

  return getTeamWatchlistPlayerIds(team.id);
}
