import "server-only";

import { and, eq } from "drizzle-orm";

import { players, rosterPlayers, teams } from "@/db/schema";
import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import {
  formatIrLockMessage,
  getIrLockViolations,
} from "@/lib/leagues/ir-lock";
import {
  formatTaxiLockMessage,
  getTaxiLockViolations,
} from "@/lib/leagues/taxi-lock";
import {
  occupiedBySlot,
  pickDefaultSlotPosition,
} from "@/lib/leagues/roster-slots";
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
      yearsExp: players.yearsExp,
      rosterRowId: rosterPlayers.id,
      slotPositionId: rosterPlayers.slotPositionId,
      taxiActivated: rosterPlayers.taxiActivated,
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

/**
 * Persist default slots for rostered players left with `slotPositionId: null`
 * (e.g. older trade executes). Keeps START% and lock checks aligned with the
 * lineup UI, which already auto-fills null into empty starters.
 */
export async function assignDefaultSlotsToUnassignedPlayers(input: {
  teamId: string;
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  irEnabled?: boolean;
  taxiEnabled?: boolean;
}): Promise<number> {
  const rostered = await listRosteredPlayers(input.teamId);
  const unassigned = rostered.filter((player) => player.slotPositionId == null);
  if (unassigned.length === 0) {
    return 0;
  }

  const occupied = occupiedBySlot(
    rostered.filter((player) => player.slotPositionId != null),
  );
  let assigned = 0;

  for (const player of unassigned) {
    const slotPositionId = pickDefaultSlotPosition({
      playerPositionId: player.primaryPositionId,
      injuryStatus: player.injuryStatus,
      rosterSlots: input.rosterSlots,
      benchSlots: input.benchSlots,
      irEnabled: input.irEnabled ?? false,
      taxiEnabled: input.taxiEnabled ?? false,
      occupiedBySlot: occupied,
    });
    await db
      .update(rosterPlayers)
      .set({ slotPositionId, updatedAt: new Date() })
      .where(eq(rosterPlayers.id, player.rosterRowId));
    occupied.set(slotPositionId, (occupied.get(slotPositionId) ?? 0) + 1);
    assigned += 1;
  }

  return assigned;
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

export async function assertTaxiAcquisitionsAllowed(
  teamId: string,
  taxiMaxYearsExp: 0 | 1 | 2 | 3 | 4 | 5 | null | undefined,
): Promise<{ error: string } | null> {
  const rostered = await listRosteredPlayers(teamId);
  const violations = getTaxiLockViolations(rostered, taxiMaxYearsExp);
  if (violations.length === 0) {
    return null;
  }
  return { error: formatTaxiLockMessage(violations) };
}

export async function assertReserveAcquisitionsAllowed(
  teamId: string,
  irEligibleStatuses: readonly string[] | null | undefined,
  taxiMaxYearsExp: 0 | 1 | 2 | 3 | 4 | 5 | null | undefined,
): Promise<{ error: string } | null> {
  const irLock = await assertIrAcquisitionsAllowed(teamId, irEligibleStatuses);
  if (irLock) return irLock;
  return assertTaxiAcquisitionsAllowed(teamId, taxiMaxYearsExp);
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
      // Null clearsAt = still on waivers (incomplete row); do not treat as expired.
      const expired =
        row.waiverClearsAt !== null &&
        row.waiverClearsAt.getTime() <= input.now;
      if (!expired) continue;
      if (ownWaived && row.id === ownWaived.id) continue;
      await tx.delete(rosterPlayers).where(eq(rosterPlayers.id, row.id));
    }

    if (ownWaived) {
      const stillOnWaivers =
        ownWaived.waiverClearsAt === null ||
        ownWaived.waiverClearsAt.getTime() > input.now;
      if (stillOnWaivers) {
        throw new Error("Player is still on waivers and must be claimed.");
      }
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
