import "server-only";

import { and, eq } from "drizzle-orm";

import { players, rosterPlayers, teams } from "@/db/schema";
import { db } from "@/lib/db";
import {
  formatIrLockMessage,
  getIrLockViolations,
} from "@/lib/leagues/ir-lock";
import { seasonUsesFaab } from "@/lib/leagues/waivers/faab";

/** Query surface shared by the root db and a transaction client. */
export type DbClient = Pick<
  typeof db,
  "select" | "insert" | "update" | "delete" | "transaction"
>;

export async function listRosteredPlayers(teamId: string) {
  return db
    .select({
      id: players.id,
      fullName: players.fullName,
      nflTeam: players.nflTeam,
      primaryPositionId: players.primaryPositionId,
      injuryStatus: players.injuryStatus,
      rosterRowId: rosterPlayers.id,
      slotPositionId: rosterPlayers.slotPositionId,
    })
    .from(rosterPlayers)
    .innerJoin(players, eq(rosterPlayers.playerId, players.id))
    .where(
      and(
        eq(rosterPlayers.teamId, teamId),
        eq(rosterPlayers.status, "rostered"),
      ),
    );
}

export async function assertIrAcquisitionsAllowed(
  teamId: string,
  irEligibleStatuses: readonly string[] | null | undefined,
): Promise<{ error: string } | null> {
  const rostered = await listRosteredPlayers(teamId);
  const violations = getIrLockViolations(rostered, irEligibleStatuses);
  if (violations.length === 0) {
    return null;
  }
  return { error: formatIrLockMessage(violations) };
}

export async function findSeasonRosterRows(
  leagueSeasonId: string,
  playerId: string,
) {
  return db
    .select({
      id: rosterPlayers.id,
      teamId: rosterPlayers.teamId,
      status: rosterPlayers.status,
      waiverClearsAt: rosterPlayers.waiverClearsAt,
    })
    .from(rosterPlayers)
    .innerJoin(teams, eq(rosterPlayers.teamId, teams.id))
    .where(
      and(
        eq(teams.leagueSeasonId, leagueSeasonId),
        eq(rosterPlayers.playerId, playerId),
      ),
    );
}

/** Insert a rostered row, or restore this team's waived row for the player. */
export async function insertOrRestoreRosteredPlayer(input: {
  leagueSeasonId: string;
  teamId: string;
  playerId: string;
  slotPositionId: string;
  seasonRows: Awaited<ReturnType<typeof findSeasonRosterRows>>;
  now: number;
  client?: DbClient;
}) {
  const dbc = input.client ?? db;
  const acquiredAt = new Date();
  const ownWaived = input.seasonRows.find(
    (row) => row.teamId === input.teamId && row.status === "waived",
  );

  await dbc.transaction(async (tx) => {
    for (const row of input.seasonRows) {
      if (row.status !== "waived") continue;
      const expired =
        row.waiverClearsAt === null || row.waiverClearsAt.getTime() <= input.now;
      if (!expired) continue;
      if (ownWaived && row.id === ownWaived.id) continue;
      await tx.delete(rosterPlayers).where(eq(rosterPlayers.id, row.id));
    }

    if (ownWaived) {
      await tx
        .update(rosterPlayers)
        .set({
          status: "rostered",
          waiverClearsAt: null,
          slotPositionId: input.slotPositionId,
          leagueSeasonId: input.leagueSeasonId,
          acquiredAt,
          updatedAt: new Date(),
        })
        .where(eq(rosterPlayers.id, ownWaived.id));
      return;
    }

    await tx.insert(rosterPlayers).values({
      leagueSeasonId: input.leagueSeasonId,
      teamId: input.teamId,
      playerId: input.playerId,
      status: "rostered",
      slotPositionId: input.slotPositionId,
      waiverClearsAt: null,
      acquiredAt,
    });
  });
}

/** Drop to waivers, or hard-delete when waivers are off / skipped. */
export async function waiveOrDeleteRosterRow(input: {
  rowId: string;
  waiversEnabled: boolean;
  dropWaiverHours: number;
  skipWaivers?: boolean;
  client?: DbClient;
}) {
  const dbc = input.client ?? db;
  if (!input.waiversEnabled || input.skipWaivers) {
    await dbc.delete(rosterPlayers).where(eq(rosterPlayers.id, input.rowId));
    return;
  }

  const waiverClearsAt = new Date(
    Date.now() + input.dropWaiverHours * 60 * 60 * 1000,
  );

  await dbc
    .update(rosterPlayers)
    .set({
      status: "waived",
      waiverClearsAt,
      slotPositionId: null,
      updatedAt: new Date(),
    })
    .where(eq(rosterPlayers.id, input.rowId));
}

export async function ensureTeamFaabRemaining(input: {
  teamId: string;
  faabRemaining: number | null;
  season: {
    waiversEnabled: boolean;
    waiverType: "priority" | "faab";
    faabBudget: number | null;
  };
}): Promise<number | null> {
  if (!seasonUsesFaab(input.season)) {
    return null;
  }
  if (input.faabRemaining != null) {
    return input.faabRemaining;
  }
  const seeded = input.season.faabBudget!;
  await db
    .update(teams)
    .set({ faabRemaining: seeded })
    .where(eq(teams.id, input.teamId));
  return seeded;
}
