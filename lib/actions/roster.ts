"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { players, rosterPlayers, teams } from "@/db/schema";
import { db } from "@/lib/db";
import { logLeagueActivity } from "@/lib/leagues/activity-log";
import {
  loadLeagueActionContext,
  loadLeagueMemberTeamContext,
} from "@/lib/leagues/action-context";
import {
  countActivePositionPlayers,
  countActiveRosterPlayers,
  countsTowardRosterMax,
  getMaxRosterSize,
  getPositionRosterMax,
  validateActiveRosterCaps,
} from "@/lib/leagues/roster-capacity";
import {
  applyLocalSlotAssignment,
  getSlotCapacity,
  occupiedBySlot,
  pickDefaultSlotPosition,
  slotAcceptsPlayer,
} from "@/lib/leagues/roster-slots";
import {
  assertIrAcquisitionsAllowed,
  findSeasonRosterRows,
  insertOrRestoreRosteredPlayer,
  listRosteredPlayers,
  waiveOrDeleteRosterRow,
} from "@/lib/leagues/roster-writes";
import { resolveIrEligibleStatuses } from "@/lib/leagues/ir-eligibility";
import { getAcquisitionKind } from "@/lib/leagues/waivers/acquisition";
import { resolveChurnCut } from "@/lib/leagues/waivers/churn";
import {
  getStartedNflTeamAbbreviations,
  hasNflTeamStarted,
} from "@/lib/leagues/waivers/game-lock";
import { resolveWaiverWireSettings } from "@/lib/leagues/waiver-wire";
import { getNflScoreboard } from "@/lib/espn/scoreboard";
import { getNflState } from "@/lib/sleeper/api";

export type RosterCutCandidate = {
  id: string;
  fullName: string;
  nflTeam: string | null;
  primaryPositionId: string;
};

export type RosterActionResult = {
  success: boolean;
  error?: string;
  playerName?: string;
  /** Roster/position cap blocked the add — client should show cut dialog. */
  requiresCut?: boolean;
  reason?: "roster_full" | "position_max";
  cutCandidates?: RosterCutCandidate[];
  pendingPlayerId?: string;
  pendingPlayerName?: string;
};

async function getRosterActionContext(slug: string) {
  return loadLeagueMemberTeamContext(slug, {
    requireFreeAgencyOpen: true,
  });
}

function revalidateRosterPaths(slug: string) {
  revalidatePath(`/league/${slug}`);
  revalidatePath(`/league/${slug}/players`);
  revalidatePath(`/league/${slug}/team`);
  revalidatePath(`/league/${slug}/settings/lineups`);
  revalidatePath(`/league/${slug}/activity`);
}

export async function addPlayerToRoster(
  slug: string,
  playerId: string,
): Promise<RosterActionResult> {
  if (!playerId) {
    return { success: false, error: "Missing player." };
  }

  const context = await getRosterActionContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { season, team, league, user } = context;

  const irLock = await assertIrAcquisitionsAllowed(
    team.id,
    season.settings.irEligibleStatuses,
  );
  if (irLock) {
    return { success: false, error: irLock.error };
  }

  const [player] = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      primaryPositionId: players.primaryPositionId,
      injuryStatus: players.injuryStatus,
      nflTeam: players.nflTeam,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (!player) {
    return { success: false, error: "Player not found." };
  }

  const now = Date.now();
  const seasonRows = await findSeasonRosterRows(season.id, playerId);
  const rostered = seasonRows.find((row) => row.status === "rostered");
  if (rostered) {
    return {
      success: false,
      error:
        rostered.teamId === team.id
          ? "Player is already on your roster."
          : "Player is already on another team.",
    };
  }

  const onWaivers = seasonRows.some(
    (row) =>
      row.status === "waived" &&
      row.waiverClearsAt !== null &&
      row.waiverClearsAt.getTime() > now,
  );
  const wire = resolveWaiverWireSettings(season.settings.waiverWire);
  let gameStartedThisWeek = false;
  if (
    season.waiversEnabled &&
    wire.waiverPool === "drops_and_free_agents" &&
    player.nflTeam
  ) {
    try {
      const nflState = await getNflState();
      const board = await getNflScoreboard({
        season: Number(nflState.season) || new Date().getUTCFullYear(),
        week: Math.max(1, Number(nflState.week) || 1),
      });
      gameStartedThisWeek = hasNflTeamStarted(
        player.nflTeam,
        getStartedNflTeamAbbreviations(board.games),
      );
    } catch {
      gameStartedThisWeek = false;
    }
  }
  const acquisitionKind = getAcquisitionKind({
    waiversEnabled: season.waiversEnabled,
    waiverWire: wire,
    rosterTransactionsEnabled: true,
    ownership: { fantasyTeamId: null, onWaivers },
    gameStartedThisWeek,
  });
  if (acquisitionKind === "claim") {
    return {
      success: false,
      error: "Player requires a waiver claim. Use Claim instead of Add.",
    };
  }
  if (acquisitionKind !== "add") {
    return { success: false, error: "Player is not available to add." };
  }

  const rosteredOnTeam = await listRosteredPlayers(team.id);

  const maxRoster = getMaxRosterSize(
    season.settings.rosterSlots,
    season.benchSlots,
  );
  const rosterFull = countActiveRosterPlayers(rosteredOnTeam) >= maxRoster;

  const positionMax = getPositionRosterMax(
    season.settings.rosterSlots,
    player.primaryPositionId,
  );
  const positionCount = countActivePositionPlayers(
    rosteredOnTeam,
    player.primaryPositionId,
  );
  const positionFull =
    positionMax !== Number.POSITIVE_INFINITY && positionCount >= positionMax;

  if (rosterFull || positionFull) {
    const cutCandidates = (
      positionFull
        ? rosteredOnTeam.filter(
            (row) =>
              row.primaryPositionId === player.primaryPositionId &&
              countsTowardRosterMax(row.slotPositionId, row.primaryPositionId),
          )
        : rosteredOnTeam.filter((row) =>
            countsTowardRosterMax(row.slotPositionId, row.primaryPositionId),
          )
    ).sort((a, b) => a.fullName.localeCompare(b.fullName));

    return {
      success: false,
      requiresCut: true,
      reason: positionFull ? "position_max" : "roster_full",
      error: positionFull
        ? `At max ${player.primaryPositionId}s (${positionMax}). Cut one first.`
        : `Roster is full (${maxRoster} players). Cut someone first.`,
      cutCandidates,
      pendingPlayerId: player.id,
      pendingPlayerName: player.fullName,
    };
  }

  await insertOrRestoreRosteredPlayer({
    leagueSeasonId: season.id,
    teamId: team.id,
    playerId,
    slotPositionId: pickDefaultSlotPosition({
      playerPositionId: player.primaryPositionId,
      injuryStatus: player.injuryStatus,
      irEligibleStatuses: resolveIrEligibleStatuses(
        season.settings.irEligibleStatuses,
      ),
      rosterSlots: season.settings.rosterSlots,
      benchSlots: season.benchSlots,
      irEnabled: season.irEnabled,
      taxiEnabled: season.taxiEnabled,
      occupiedBySlot: occupiedBySlot(rosteredOnTeam),
    }),
    seasonRows,
    now,
  });

  await logLeagueActivity({
    leagueSeasonId: season.id,
    type: "player_added",
    teamId: team.id,
    actorUserId: user.id,
    playerId: player.id,
    summary: `${team.name} added ${player.fullName}`,
    metadata: { playerName: player.fullName, teamName: team.name },
  });

  revalidateRosterPaths(league.publicId);
  return { success: true, playerName: player.fullName };
}

/** Cut one rostered player, then add the pending free agent. */
export async function cutAndAddPlayer(
  slug: string,
  cutPlayerId: string,
  addPlayerId: string,
): Promise<RosterActionResult> {
  if (!cutPlayerId || !addPlayerId) {
    return { success: false, error: "Missing player." };
  }
  if (cutPlayerId === addPlayerId) {
    return { success: false, error: "Choose a different player to cut." };
  }

  const cutResult = await cutPlayerFromRoster(slug, cutPlayerId);
  if (!cutResult.success) {
    return cutResult;
  }

  const addResult = await addPlayerToRoster(slug, addPlayerId);
  if (!addResult.success) {
    return {
      ...addResult,
      error:
        addResult.error ??
        "Player was cut, but the add failed. Try adding again.",
    };
  }

  return {
    success: true,
    playerName: addResult.playerName,
  };
}

export async function cutPlayerFromRoster(
  slug: string,
  playerId: string,
): Promise<RosterActionResult> {
  if (!playerId) {
    return { success: false, error: "Missing player." };
  }

  const context = await getRosterActionContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { season, team, league, user } = context;

  const [row] = await db
    .select({
      id: rosterPlayers.id,
      status: rosterPlayers.status,
      acquiredAt: rosterPlayers.acquiredAt,
      fullName: players.fullName,
    })
    .from(rosterPlayers)
    .innerJoin(players, eq(rosterPlayers.playerId, players.id))
    .where(
      and(
        eq(rosterPlayers.teamId, team.id),
        eq(rosterPlayers.playerId, playerId),
        eq(rosterPlayers.status, "rostered"),
      ),
    )
    .limit(1);

  if (!row) {
    return { success: false, error: "Player is not on your roster." };
  }

  const wire = resolveWaiverWireSettings(season.settings.waiverWire);
  const churn = resolveChurnCut({
    churnPrevention: wire.churnPrevention,
    processDays: wire.processDays,
    dropWaiverHours: wire.dropWaiverHours,
    acquiredAt: row.acquiredAt,
  });
  if (!churn.allow) {
    return { success: false, error: churn.error };
  }

  await waiveOrDeleteRosterRow({
    rowId: row.id,
    waiversEnabled: season.waiversEnabled,
    dropWaiverHours: wire.dropWaiverHours,
    skipWaivers: churn.skipWaivers,
  });

  await logLeagueActivity({
    leagueSeasonId: season.id,
    type: "player_dropped",
    teamId: team.id,
    actorUserId: user.id,
    playerId,
    summary: `${team.name} dropped ${row.fullName}`,
    metadata: { playerName: row.fullName, teamName: team.name },
  });

  revalidateRosterPaths(league.publicId);
  return { success: true, playerName: row.fullName };
}

export async function assignPlayerSlot(
  slug: string,
  playerId: string,
  slotPositionId: string,
): Promise<RosterActionResult> {
  if (!playerId || !slotPositionId) {
    return { success: false, error: "Missing player or slot." };
  }

  const context = await getRosterActionContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { season, team, league, user } = context;
  const irEligibleStatuses = resolveIrEligibleStatuses(
    season.settings.irEligibleStatuses,
  );
  const rosteredOnTeam = await listRosteredPlayers(team.id);
  const applied = applyLocalSlotAssignment(
    rosteredOnTeam,
    playerId,
    slotPositionId,
    season.settings.rosterSlots,
    season.benchSlots,
    irEligibleStatuses,
  );

  if ("error" in applied) {
    return { success: false, error: applied.error };
  }

  return persistRosterSlotAssignments(
    league.publicId,
    rosteredOnTeam,
    applied.players,
    {
      leagueSeasonId: season.id,
      teamId: team.id,
      teamName: team.name,
      actorUserId: user.id,
    },
  );
}

/** Persist a full set of lineup slot assignments in one transaction. */
export async function updateRosterSlots(
  slug: string,
  assignments: Array<{ playerId: string; slotPositionId: string }>,
): Promise<RosterActionResult> {
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return { success: false, error: "No roster changes to save." };
  }

  const context = await getRosterActionContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { season, team, league, user } = context;
  return applyRosterSlotAssignments({
    leagueSlug: league.publicId,
    season,
    teamId: team.id,
    teamName: team.name,
    actorUserId: user.id,
    assignments,
    notOnRosterError: "Player is not on your roster.",
  });
}

/**
 * Commissioner override: set any team's lineup slots.
 * Skips free-agency gate; still validates slot eligibility and capacity.
 */
export async function commissionerUpdateRosterSlots(
  slug: string,
  teamId: string,
  assignments: Array<{ playerId: string; slotPositionId: string }>,
): Promise<RosterActionResult> {
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return { success: false, error: "No roster changes to save." };
  }
  if (!teamId) {
    return { success: false, error: "Team is required." };
  }

  const context = await loadLeagueActionContext(slug, {
    requireCommissioner: true,
    commissionerError: "Only the commissioner can edit lineups.",
  });
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { user, league, season } = context;

  const [team] = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.leagueSeasonId, season.id)))
    .limit(1);

  if (!team) {
    return { success: false, error: "Team not found in this league." };
  }

  return applyRosterSlotAssignments({
    leagueSlug: league.publicId,
    season,
    teamId: team.id,
    teamName: team.name,
    actorUserId: user.id,
    assignments,
    notOnRosterError: "Player is not on this team's roster.",
  });
}

async function applyRosterSlotAssignments(input: {
  leagueSlug: string;
  season: {
    id: string;
    settings: {
      rosterSlots: Parameters<typeof getSlotCapacity>[0];
      irEligibleStatuses?: string[] | null;
    };
    benchSlots: number;
  };
  teamId: string;
  teamName: string;
  actorUserId: string;
  assignments: Array<{ playerId: string; slotPositionId: string }>;
  notOnRosterError: string;
}): Promise<RosterActionResult> {
  const {
    leagueSlug,
    season,
    teamId,
    teamName,
    actorUserId,
    assignments,
    notOnRosterError,
  } = input;
  const irEligibleStatuses = resolveIrEligibleStatuses(
    season.settings.irEligibleStatuses,
  );
  const rosteredOnTeam = await listRosteredPlayers(teamId);
  const byId = new Map(rosteredOnTeam.map((row) => [row.id, row]));
  const assignmentById = new Map(
    assignments.map((row) => [row.playerId, row.slotPositionId]),
  );

  const nextPlayers = rosteredOnTeam.map((row) => {
    const nextSlot = assignmentById.get(row.id);
    return {
      ...row,
      slotPositionId: nextSlot ?? row.slotPositionId ?? row.primaryPositionId,
    };
  });

  for (const player of nextPlayers) {
    const slotPositionId = player.slotPositionId ?? player.primaryPositionId;
    const current = byId.get(player.id);
    if (!current) {
      return { success: false, error: notOnRosterError };
    }

    const previousSlot = current.slotPositionId ?? current.primaryPositionId;
    const movingOntoIr = slotPositionId === "IR" && previousSlot !== "IR";

    if (movingOntoIr) {
      if (
        !slotAcceptsPlayer("IR", player.primaryPositionId, {
          injuryStatus: player.injuryStatus,
          irEligibleStatuses,
        })
      ) {
        return {
          success: false,
          error: `${player.fullName} is not eligible for IR.`,
        };
      }
      continue;
    }

    if (slotPositionId === "IR") {
      continue;
    }

    if (
      !slotAcceptsPlayer(slotPositionId, player.primaryPositionId, {
        injuryStatus: player.injuryStatus,
        irEligibleStatuses,
      })
    ) {
      return {
        success: false,
        error: `${player.primaryPositionId} cannot play ${slotPositionId}.`,
      };
    }
  }

  const occupancy = new Map<string, number>();
  for (const player of nextPlayers) {
    const slot = player.slotPositionId ?? player.primaryPositionId;
    occupancy.set(slot, (occupancy.get(slot) ?? 0) + 1);
  }

  for (const [slotPositionId, count] of occupancy) {
    const capacity = getSlotCapacity(
      season.settings.rosterSlots,
      slotPositionId,
      season.benchSlots,
    );
    if (capacity > 0 && count > capacity) {
      return {
        success: false,
        error: `Too many players assigned to ${slotPositionId}.`,
      };
    }
  }

  const caps = validateActiveRosterCaps(
    nextPlayers,
    season.settings.rosterSlots,
    season.benchSlots,
  );
  if (!caps.ok) {
    return { success: false, error: caps.error };
  }

  return persistRosterSlotAssignments(
    leagueSlug,
    rosteredOnTeam,
    nextPlayers,
    {
      leagueSeasonId: season.id,
      teamId,
      teamName,
      actorUserId,
    },
  );
}

async function persistRosterSlotAssignments(
  leagueSlug: string,
  current: Array<{
    id: string;
    fullName: string;
    rosterRowId: string;
    slotPositionId: string | null;
    primaryPositionId: string;
  }>,
  next: Array<{
    id: string;
    slotPositionId: string | null;
  }>,
  activity: {
    leagueSeasonId: string;
    teamId: string;
    teamName: string;
    actorUserId: string;
  },
): Promise<RosterActionResult> {
  const nextById = new Map(next.map((row) => [row.id, row.slotPositionId]));
  const persist = current
    .map((row) => {
      const slotPositionId = nextById.get(row.id);
      if (!slotPositionId || row.slotPositionId === slotPositionId) {
        return null;
      }
      return {
        playerId: row.id,
        fullName: row.fullName,
        rosterRowId: row.rosterRowId,
        previousSlot: row.slotPositionId ?? row.primaryPositionId,
        slotPositionId,
      };
    })
    .filter(
      (
        row,
      ): row is {
        playerId: string;
        fullName: string;
        rosterRowId: string;
        previousSlot: string;
        slotPositionId: string;
      } => Boolean(row),
    );

  if (persist.length === 0) {
    return { success: true };
  }

  await db.transaction(async (tx) => {
    for (const row of persist) {
      await tx
        .update(rosterPlayers)
        .set({
          slotPositionId: row.slotPositionId,
          updatedAt: new Date(),
        })
        .where(eq(rosterPlayers.id, row.rosterRowId));
    }
  });

  for (const row of persist) {
    const events: Array<{
      type: "ir_added" | "ir_removed" | "taxi_added" | "taxi_removed";
      summary: string;
    }> = [];

    if (row.previousSlot !== "IR" && row.slotPositionId === "IR") {
      events.push({
        type: "ir_added",
        summary: `${activity.teamName} added ${row.fullName} to IR`,
      });
    }
    if (row.previousSlot === "IR" && row.slotPositionId !== "IR") {
      events.push({
        type: "ir_removed",
        summary: `${activity.teamName} removed ${row.fullName} from IR`,
      });
    }
    if (row.previousSlot !== "TAXI" && row.slotPositionId === "TAXI") {
      events.push({
        type: "taxi_added",
        summary: `${activity.teamName} added ${row.fullName} to taxi`,
      });
    }
    if (row.previousSlot === "TAXI" && row.slotPositionId !== "TAXI") {
      events.push({
        type: "taxi_removed",
        summary: `${activity.teamName} removed ${row.fullName} from taxi`,
      });
    }

    for (const event of events) {
      await logLeagueActivity({
        leagueSeasonId: activity.leagueSeasonId,
        type: event.type,
        teamId: activity.teamId,
        actorUserId: activity.actorUserId,
        playerId: row.playerId,
        summary: event.summary,
        metadata: {
          playerName: row.fullName,
          teamName: activity.teamName,
        },
      });
    }
  }

  revalidateRosterPaths(leagueSlug);
  return { success: true };
}
