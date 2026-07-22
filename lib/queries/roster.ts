import { and, eq } from "drizzle-orm";

import { rosterPlayers, teams } from "@/db/schema";
import { db } from "@/lib/db";

export type PlayerLeagueOwnership = {
  fantasyTeamId: string | null;
  fantasyTeamName: string | null;
  fantasyTeamSlug: string | null;
  isOwnedByCurrentUser: boolean;
  onWaivers: boolean;
};

export type LeaguePlayerOwnershipMap = Map<string, PlayerLeagueOwnership>;

export type OwnershipMapRow = {
  playerId: string;
  status: "rostered" | "waived";
  waiverClearsAt: Date | null;
  teamId: string;
  teamName: string;
  teamSlug: string;
  userId: string | null;
};

const FREE_AGENT: PlayerLeagueOwnership = {
  fantasyTeamId: null,
  fantasyTeamName: null,
  fantasyTeamSlug: null,
  isOwnedByCurrentUser: false,
  onWaivers: false,
};

/**
 * Build per-player ownership for a league season.
 *
 * Precedence:
 * 1. Any `rostered` row for a player wins (waived rows for that player are ignored).
 * 2. Else any `waived` row with `waiverClearsAt > now` → on waivers.
 * 3. Else free agent (omitted from the map).
 * 4. If multiple `rostered` rows exist (data corruption), pick the lowest `teamId`.
 */
export function buildOwnershipMap(
  rows: OwnershipMapRow[],
  currentUserId: string,
  nowMs: number,
): LeaguePlayerOwnershipMap {
  const rosteredByPlayer = new Map<string, OwnershipMapRow>();
  const waivedByPlayer = new Map<string, OwnershipMapRow>();

  for (const row of rows) {
    if (row.status === "rostered") {
      const existing = rosteredByPlayer.get(row.playerId);
      if (!existing || row.teamId < existing.teamId) {
        rosteredByPlayer.set(row.playerId, row);
      }
      continue;
    }

    const stillOnWaivers =
      row.waiverClearsAt !== null && row.waiverClearsAt.getTime() > nowMs;
    if (!stillOnWaivers) {
      continue;
    }

    const existing = waivedByPlayer.get(row.playerId);
    if (!existing || row.teamId < existing.teamId) {
      waivedByPlayer.set(row.playerId, row);
    }
  }

  const map: LeaguePlayerOwnershipMap = new Map();

  for (const [playerId, row] of rosteredByPlayer) {
    map.set(playerId, {
      fantasyTeamId: row.teamId,
      fantasyTeamName: row.teamName,
      fantasyTeamSlug: row.teamSlug,
      isOwnedByCurrentUser: row.userId === currentUserId,
      onWaivers: false,
    });
  }

  for (const [playerId] of waivedByPlayer) {
    if (map.has(playerId)) {
      continue;
    }
    map.set(playerId, {
      fantasyTeamId: null,
      fantasyTeamName: null,
      fantasyTeamSlug: null,
      isOwnedByCurrentUser: false,
      onWaivers: true,
    });
  }

  return map;
}

export async function getLeaguePlayerOwnershipMap(
  leagueSeasonId: string,
  currentUserId: string,
): Promise<LeaguePlayerOwnershipMap> {
  const rows = await db
    .select({
      playerId: rosterPlayers.playerId,
      status: rosterPlayers.status,
      waiverClearsAt: rosterPlayers.waiverClearsAt,
      teamId: teams.id,
      teamName: teams.name,
      teamSlug: teams.slug,
      userId: teams.userId,
    })
    .from(rosterPlayers)
    .innerJoin(teams, eq(rosterPlayers.teamId, teams.id))
    .where(eq(teams.leagueSeasonId, leagueSeasonId));

  return buildOwnershipMap(
    rows.map((row) => ({
      ...row,
      teamSlug: row.teamSlug ?? row.teamId,
    })),
    currentUserId,
    Date.now(),
  );
}

export async function getTeamRosteredPlayerIds(
  teamId: string,
): Promise<string[]> {
  const rows = await db
    .select({ playerId: rosterPlayers.playerId })
    .from(rosterPlayers)
    .where(
      and(
        eq(rosterPlayers.teamId, teamId),
        eq(rosterPlayers.status, "rostered"),
      ),
    );

  return rows.map((row) => row.playerId);
}

export function resolvePlayerOwnership(
  map: LeaguePlayerOwnershipMap,
  playerId: string,
): PlayerLeagueOwnership {
  return map.get(playerId) ?? FREE_AGENT;
}
