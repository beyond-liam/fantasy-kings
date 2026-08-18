import { and, asc, eq } from "drizzle-orm";

import { players, profiles, rosterPlayers, teams } from "@/db/schema";
import { db } from "@/lib/db";
import { formatPersonName } from "@/lib/account/person-name";
import type { DbClient } from "@/lib/leagues/roster-writes";
import {
  groupNonKeepersForClearance,
  type NonKeeperClearanceTeam,
  type RosteredKeeperRow,
} from "@/lib/leagues/keepers/clearance";

export type KeeperTeamOption = {
  teamId: string;
  teamName: string;
  ownerName: string | null;
};

export async function listKeeperTeamOptions(
  leagueSeasonId: string,
): Promise<KeeperTeamOption[]> {
  const rows = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      username: profiles.username,
      displayName: profiles.displayName,
      userId: teams.userId,
    })
    .from(teams)
    .leftJoin(profiles, eq(teams.userId, profiles.id))
    .where(eq(teams.leagueSeasonId, leagueSeasonId))
    .orderBy(asc(teams.name));

  return rows.map((row) => ({
    teamId: row.teamId,
    teamName: row.teamName,
    ownerName: row.userId ? formatPersonName(row) : null,
  }));
}

export async function listRosteredKeeperRows(
  leagueSeasonId: string,
  client: DbClient = db,
): Promise<RosteredKeeperRow[]> {
  const rows = await client
    .select({
      rosterRowId: rosterPlayers.id,
      teamId: teams.id,
      teamName: teams.name,
      userId: teams.userId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      username: profiles.username,
      displayName: profiles.displayName,
      playerId: players.id,
      playerName: players.fullName,
      isKeeper: rosterPlayers.isKeeper,
    })
    .from(rosterPlayers)
    .innerJoin(teams, eq(rosterPlayers.teamId, teams.id))
    .innerJoin(players, eq(rosterPlayers.playerId, players.id))
    .leftJoin(profiles, eq(teams.userId, profiles.id))
    .where(
      and(
        eq(teams.leagueSeasonId, leagueSeasonId),
        eq(rosterPlayers.status, "rostered"),
      ),
    );

  return rows.map((row) => ({
    rosterRowId: row.rosterRowId,
    teamId: row.teamId,
    teamName: row.teamName,
    ownerName: row.userId ? formatPersonName(row) : null,
    playerId: row.playerId,
    playerName: row.playerName,
    isKeeper: row.isKeeper,
  }));
}

export async function getNonKeeperClearancePreview(
  leagueSeasonId: string,
): Promise<NonKeeperClearanceTeam[]> {
  const rows = await listRosteredKeeperRows(leagueSeasonId);
  return groupNonKeepersForClearance(rows);
}
