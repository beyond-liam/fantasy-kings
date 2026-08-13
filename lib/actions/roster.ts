"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { players, rosterPlayers, teams } from "@/db/schema";
import { db } from "@/lib/db";
import { logLeagueActivity, logReservePlacementFromAcquisition } from "@/lib/leagues/activity-log";
import {
  loadLeagueActionContext,
  loadLeagueMemberTeamContext,
  type LeagueMemberTeamContext,
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
  slotAcceptsPlayer,
} from "@/lib/leagues/roster-slots";
import { compareRosterPositions } from "@/lib/leagues/roster-position-order";
import {
  classifyDropCandidatesForMinimums,
  firstRosterMinimumError,
  simulateRosterAfterMutation,
  wouldBreachRosterMinimums,
} from "@/lib/leagues/roster-minimums";
import {
  assertCutAllowedAfterGameStart,
  assertCutAllowedUnderLineupLock,
  pickOpenReserveAcquisitionSlot,
  resolveAcquisitionSlotPosition,
} from "@/lib/leagues/roster/acquisition";
import { findBlockedGameStartMoves } from "@/lib/leagues/roster/game-start-lock";
import { resolveTransactionRules } from "@/lib/leagues/transaction-rules";
import {
  assertReserveAcquisitionsAllowed,
  findSeasonRosterRows,
  insertOrRestoreRosteredPlayer,
  listRosteredPlayers,
  waiveOrDeleteRosterRow,
} from "@/lib/leagues/roster-writes";
import { resolveIrEligibleStatuses } from "@/lib/leagues/ir-eligibility";
import {
  resolveTaxiMaxYearsExp,
  resolveTaxiPreventReaddAfterActivation,
  TAXI_ACTIVATED_BLOCK_MESSAGE,
  canMovePlayerToTaxi,
} from "@/lib/leagues/taxi-eligibility";
import { findBlockedLineupMoves } from "@/lib/leagues/lineup-lock-enforce";
import { parseLineupLockMode } from "@/lib/leagues/lineup-lock";
import { loadStartedNflTeamsForLineupLock } from "@/lib/leagues/lineup-lock-started";
import { getAcquisitionKind } from "@/lib/leagues/waivers/acquisition";
import { getDropWaiverClearsAt } from "@/lib/leagues/waivers/daily-drops";
import {
  getWaiverProcessDays,
  isWaiverClaimOrderLocked,
  WAIVER_PROCESSING_WINDOW_LOCK_REASON,
} from "@/lib/leagues/waivers/calendar";
import { resolveChurnCut } from "@/lib/leagues/waivers/churn";
import { isFantasyLeaguePreseason } from "@/lib/leagues/season-calendar";
import {
  getStartedNflTeamAbbreviations,
  hasNflTeamStarted,
} from "@/lib/leagues/waivers/game-lock";
import { resolveWaiverWireSettings } from "@/lib/leagues/waiver-wire";
import { getNflScoreboard } from "@/lib/espn/scoreboard";
import { getNflState } from "@/lib/sleeper/api";

const playerIdSchema = z.string().uuid();

const cutAndAddSchema = z.object({
  cutPlayerId: z.string().uuid(),
  addPlayerId: z.string().uuid(),
});

const assignSlotSchema = z.object({
  playerId: z.string().uuid(),
  slotPositionId: z.string().min(1),
});

const rosterSlotsSchema = z.object({
  slotAssignments: z.array(
    z.object({
      playerId: z.string().uuid(),
      slotPositionId: z.string().min(1),
    }),
  ),
});

export type RosterCutCandidate = {
  id: string;
  fullName: string;
  nflTeam: string | null;
  primaryPositionId: string;
  sleeperId?: string | null;
  byeWeek?: number | null;
  /** When enforce roster minimums blocks this cut/drop. */
  minimumBlocked?: boolean;
  minimumBlockReason?: string | null;
};

function toCutCandidate(row: {
  id: string;
  fullName: string;
  nflTeam: string | null;
  primaryPositionId: string;
  sleeperId?: string | null;
  byeWeek?: number | null;
}): RosterCutCandidate {
  return {
    id: row.id,
    fullName: row.fullName,
    nflTeam: row.nflTeam,
    primaryPositionId: row.primaryPositionId,
    sleeperId: row.sleeperId ?? null,
    byeWeek: row.byeWeek ?? null,
  };
}

function sortCutCandidates(a: RosterCutCandidate, b: RosterCutCandidate) {
  const byPosition = compareRosterPositions(
    a.primaryPositionId,
    b.primaryPositionId,
  );
  if (byPosition !== 0) return byPosition;
  return a.fullName.localeCompare(b.fullName);
}

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

/** Lineup slot moves — allowed during draft; does not require free agency. */
async function getLineupActionContext(slug: string) {
  return loadLeagueMemberTeamContext(slug);
}

function revalidateRosterPaths(slug: string) {
  revalidatePath(`/league/${slug}`);
  revalidatePath(`/league/${slug}/players`);
  revalidatePath(`/league/${slug}/team`);
  revalidatePath(`/league/${slug}/settings/lineups`);
  revalidatePath(`/league/${slug}/activity`);
}

type PrepareAddSuccess = {
  ok: true;
  player: {
    id: string;
    fullName: string;
    primaryPositionId: string;
    injuryStatus: string | null;
  };
  seasonRows: Awaited<ReturnType<typeof findSeasonRosterRows>>;
  slotPositionId: string;
  now: number;
};
type PrepareAddFailure = { ok: false; result: RosterActionResult };

/** Validate that a player can be added — no writes. Caps can exclude an in-flight cut. */
async function prepareAdd(
  context: LeagueMemberTeamContext,
  playerId: string,
  opts: { excludeRosterRowId?: string } = {},
): Promise<PrepareAddSuccess | PrepareAddFailure> {
  const { season, team } = context;

  const irLock = await assertReserveAcquisitionsAllowed(
    team.id,
    season.settings.irEligibleStatuses,
    season.settings.taxiMaxYearsExp,
  );
  if (irLock) {
    return { ok: false, result: { success: false, error: irLock.error } };
  }

  const { assertTransactionLimitsAllow } = await import(
    "@/lib/leagues/transaction-limits"
  );
  const limitError = await assertTransactionLimitsAllow({
    leagueSeasonId: season.id,
    teamId: team.id,
    seasonYear: season.seasonYear,
    rules: season.settings.transactionRules,
  });
  if (limitError) {
    return { ok: false, result: { success: false, error: limitError } };
  }

  const [player] = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      primaryPositionId: players.primaryPositionId,
      injuryStatus: players.injuryStatus,
      nflTeam: players.nflTeam,
      yearsExp: players.yearsExp,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (!player) {
    return { ok: false, result: { success: false, error: "Player not found." } };
  }

  const now = Date.now();
  const seasonRows = await findSeasonRosterRows(season.id, playerId);
  const rostered = seasonRows.find((row) => row.status === "rostered");
  if (rostered) {
    return {
      ok: false,
      result: {
        success: false,
        error:
          rostered.teamId === team.id
            ? "Player is already on your roster."
            : "Player is already on another team.",
      },
    };
  }

  const onWaivers = seasonRows.some(
    (row) =>
      row.status === "waived" &&
      (row.waiverClearsAt === null ||
        row.waiverClearsAt.getTime() > now),
  );
  const wire = resolveWaiverWireSettings(
    season.settings.waiverWire,
    season.settings.transactionRules?.preseasonFreeAgents,
  );
  if (
    season.waiversEnabled &&
    isWaiverClaimOrderLocked(wire)
  ) {
    return {
      ok: false,
      result: {
        success: false,
        error: WAIVER_PROCESSING_WINDOW_LOCK_REASON,
      },
    };
  }
  let gameStartedThisWeek = false;
  let isFantasyPreseason = false;
  try {
    const nflState = await getNflState();
    isFantasyPreseason = isFantasyLeaguePreseason(
      season.seasonYear,
      nflState,
      season.settings.schedule,
    );
    if (
      season.waiversEnabled &&
      wire.waiverPool === "drops_and_free_agents" &&
      player.nflTeam
    ) {
      const board = await getNflScoreboard({
        season: Number(nflState.season) || new Date().getUTCFullYear(),
        week: Math.max(1, Number(nflState.week) || 1),
      });
      gameStartedThisWeek = hasNflTeamStarted(
        player.nflTeam,
        getStartedNflTeamAbbreviations(board.games),
      );
    }
  } catch {
    gameStartedThisWeek = false;
  }
  const acquisitionKind = getAcquisitionKind({
    waiversEnabled: season.waiversEnabled,
    waiverWire: wire,
    rosterTransactionsEnabled: true,
    isFantasyPreseason,
    ownership: { fantasyTeamId: null, onWaivers },
    gameStartedThisWeek,
  });
  if (acquisitionKind === "claim") {
    return {
      ok: false,
      result: {
        success: false,
        error: "Player requires a waiver claim. Use Claim instead of Add.",
      },
    };
  }
  if (acquisitionKind !== "add") {
    return {
      ok: false,
      result: { success: false, error: "Player is not available to add." },
    };
  }

  const fullRosteredOnTeam = await listRosteredPlayers(team.id);
  const rosteredOnTeam = opts.excludeRosterRowId
    ? fullRosteredOnTeam.filter(
        (row) => row.rosterRowId !== opts.excludeRosterRowId,
      )
    : fullRosteredOnTeam;

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

  const reserveArgs = {
    player: {
      primaryPositionId: player.primaryPositionId,
      injuryStatus: player.injuryStatus,
      yearsExp: player.yearsExp,
    },
    rosteredOnTeam,
    rosterSlots: season.settings.rosterSlots,
    benchSlots: season.benchSlots,
    irEnabled: season.irEnabled,
    taxiEnabled: season.taxiEnabled,
    irEligibleStatuses: season.settings.irEligibleStatuses,
    taxiMaxYearsExp: season.settings.taxiMaxYearsExp,
    taxiPreventReaddAfterActivation:
      season.settings.taxiPreventReaddAfterActivation,
  };

  /** Active roster full → try IR/Taxi instead of forcing a cut. */
  const forceReserveSlot = rosterFull
    ? pickOpenReserveAcquisitionSlot(reserveArgs)
    : null;

  if ((rosterFull || positionFull) && !forceReserveSlot) {
    const rules = resolveTransactionRules(season.settings.transactionRules);
    const activeCuts = (
      positionFull
        ? rosteredOnTeam.filter(
            (row) =>
              row.primaryPositionId === player.primaryPositionId &&
              countsTowardRosterMax(row.slotPositionId, row.primaryPositionId),
          )
        : rosteredOnTeam.filter((row) =>
            countsTowardRosterMax(row.slotPositionId, row.primaryPositionId),
          )
    ).map(toCutCandidate);

    const classified = classifyDropCandidatesForMinimums({
      candidates: activeCuts,
      roster: rosteredOnTeam,
      rosterSlots: season.settings.rosterSlots,
      enforce: rules.enforceRosterMinimums,
      incoming: [
        {
          id: player.id,
          primaryPositionId: player.primaryPositionId,
          slotPositionId: null,
        },
      ],
    });

    const cutCandidates = [
      ...classified.eligible.map((row) => ({
        ...row,
        minimumBlocked: false,
        minimumBlockReason: null,
      })),
      ...classified.ineligible.map(({ player: row, reason }) => ({
        ...row,
        minimumBlocked: true,
        minimumBlockReason: reason,
      })),
    ].toSorted(sortCutCandidates);

    return {
      ok: false,
      result: {
        success: false,
        requiresCut: true,
        reason: positionFull && !rosterFull ? "position_max" : "roster_full",
        error: positionFull && !rosterFull
          ? `At max ${player.primaryPositionId}s (${positionMax}). Cut one first.`
          : `Roster is full (${maxRoster} players). Cut someone first.`,
        cutCandidates,
        pendingPlayerId: player.id,
        pendingPlayerName: player.fullName,
      },
    };
  }

  const slotResolved = await resolveAcquisitionSlotPosition({
    player,
    rosteredOnTeam,
    rosterSlots: season.settings.rosterSlots,
    benchSlots: season.benchSlots,
    irEnabled: season.irEnabled,
    taxiEnabled: season.taxiEnabled,
    irEligibleStatuses: season.settings.irEligibleStatuses,
    lineupLockMode: season.settings.lineupLockMode,
    taxiMaxYearsExp: season.settings.taxiMaxYearsExp,
    taxiPreventReaddAfterActivation:
      season.settings.taxiPreventReaddAfterActivation,
    forceReserveSlot: forceReserveSlot ?? undefined,
    failIfReserveBlocked: true,
  });
  if (!slotResolved.ok) {
    return { ok: false, result: { success: false, error: slotResolved.error } };
  }

  return {
    ok: true,
    player: {
      id: player.id,
      fullName: player.fullName,
      primaryPositionId: player.primaryPositionId,
      injuryStatus: player.injuryStatus,
    },
    seasonRows,
    slotPositionId: slotResolved.slotPositionId,
    now,
  };
}

export async function addPlayerToRoster(
  slug: string,
  playerId: string,
): Promise<RosterActionResult> {
  const parsed = playerIdSchema.safeParse(playerId);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid player ID.",
    };
  }

  const context = await getRosterActionContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { season, team, league, user } = context;

  const prepared = await prepareAdd(context, parsed.data);
  if (!prepared.ok) {
    return prepared.result;
  }

  await insertOrRestoreRosteredPlayer({
    leagueSeasonId: season.id,
    teamId: team.id,
    playerId: parsed.data,
    slotPositionId: prepared.slotPositionId,
    seasonRows: prepared.seasonRows,
    now: prepared.now,
  });

  const activityAt = new Date();
  await logLeagueActivity({
    leagueSeasonId: season.id,
    type: "player_added",
    teamId: team.id,
    actorUserId: user.id,
    playerId: prepared.player.id,
    summary: `${team.name} added ${prepared.player.fullName}`,
    metadata: { playerName: prepared.player.fullName, teamName: team.name },
    createdAt: activityAt,
  });
  await logReservePlacementFromAcquisition({
    leagueSeasonId: season.id,
    teamId: team.id,
    actorUserId: user.id,
    playerId: prepared.player.id,
    slotPositionId: prepared.slotPositionId,
    teamName: team.name,
    playerName: prepared.player.fullName,
    createdAt: activityAt,
  });

  revalidateRosterPaths(league.publicId);
  return { success: true, playerName: prepared.player.fullName };
}

function dropWaiverClearsAt(
  wire: ReturnType<typeof resolveWaiverWireSettings>,
): Date {
  return getDropWaiverClearsAt({ wire });
}

type PrepareCutSuccess = {
  row: { id: string; fullName: string; nflTeam: string | null };
  skipWaivers: boolean;
  wire: ReturnType<typeof resolveWaiverWireSettings>;
};
type PrepareCutResult = PrepareCutSuccess | { error: string };

/** Validate that a rostered player can be cut — no writes. */
async function prepareCut(
  context: LeagueMemberTeamContext,
  playerId: string,
  opts?: {
    /** Skip min check when a same-transaction add will be validated separately. */
    skipRosterMinimumCheck?: boolean;
  },
): Promise<PrepareCutResult> {
  const { season, team } = context;

  const [row] = await db
    .select({
      id: rosterPlayers.id,
      status: rosterPlayers.status,
      acquiredAt: rosterPlayers.acquiredAt,
      slotPositionId: rosterPlayers.slotPositionId,
      fullName: players.fullName,
      nflTeam: players.nflTeam,
      primaryPositionId: players.primaryPositionId,
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
    return { error: "Player is not on your roster." };
  }

  const wire = resolveWaiverWireSettings(
    season.settings.waiverWire,
    season.settings.transactionRules?.preseasonFreeAgents,
  );
  const churn = resolveChurnCut({
    churnPrevention: wire.churnPrevention,
    processDays: getWaiverProcessDays(wire),
    dropWaiverHours: wire.dropWaiverHours,
    acquiredAt: row.acquiredAt,
  });
  if (!churn.allow) {
    return { error: churn.error };
  }

  const previousSlot = row.slotPositionId ?? row.primaryPositionId;
  const cutBlocked = await assertCutAllowedUnderLineupLock({
    lineupLockMode: season.settings.lineupLockMode,
    fullName: row.fullName,
    nflTeam: row.nflTeam,
    previousSlot,
  });
  if (cutBlocked) {
    return { error: cutBlocked };
  }

  const rules = resolveTransactionRules(season.settings.transactionRules);
  const gameStartCutBlocked = await assertCutAllowedAfterGameStart({
    preventCutsAfterGameStart: rules.preventCutsAfterGameStart,
    fullName: row.fullName,
    nflTeam: row.nflTeam,
  });
  if (gameStartCutBlocked) {
    return { error: gameStartCutBlocked };
  }

  if (!opts?.skipRosterMinimumCheck && rules.enforceRosterMinimums) {
    const rostered = await listRosteredPlayers(team.id);
    const breach = wouldBreachRosterMinimums({
      roster: rostered,
      removeIds: [playerId],
      rosterSlots: season.settings.rosterSlots,
      enforce: true,
    });
    if (breach) {
      return {
        error:
          firstRosterMinimumError(
            rostered.filter((p) => p.id !== playerId),
            season.settings.rosterSlots,
            true,
          ) ?? "This cut would leave you under a roster minimum.",
      };
    }
  }

  return {
    row: { id: row.id, fullName: row.fullName, nflTeam: row.nflTeam },
    skipWaivers: churn.skipWaivers,
    wire,
  };
}

export async function cutPlayerFromRoster(
  slug: string,
  playerId: string,
): Promise<RosterActionResult> {
  const parsed = playerIdSchema.safeParse(playerId);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid player ID.",
    };
  }

  const context = await getRosterActionContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { season, team, league, user } = context;

  const prepared = await prepareCut(context, parsed.data);
  if ("error" in prepared) {
    return { success: false, error: prepared.error };
  }

  await waiveOrDeleteRosterRow({
    rowId: prepared.row.id,
    waiversEnabled: season.waiversEnabled,
    dropWaiverHours: prepared.wire.dropWaiverHours,
    skipWaivers: prepared.skipWaivers,
    waiverClearsAt: dropWaiverClearsAt(prepared.wire),
  });

  await logLeagueActivity({
    leagueSeasonId: season.id,
    type: "player_dropped",
    teamId: team.id,
    actorUserId: user.id,
    playerId: parsed.data,
    summary: `${team.name} dropped ${prepared.row.fullName}`,
    metadata: { playerName: prepared.row.fullName, teamName: team.name },
  });

  revalidateRosterPaths(league.publicId);
  return { success: true, playerName: prepared.row.fullName };
}

/** Cut one rostered player and add the pending free agent in a single transaction. */
export async function cutAndAddPlayer(
  slug: string,
  cutPlayerId: string,
  addPlayerId: string,
): Promise<RosterActionResult> {
  const parsed = cutAndAddSchema.safeParse({ cutPlayerId, addPlayerId });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid player IDs.",
    };
  }

  const { cutPlayerId: cutId, addPlayerId: addId } = parsed.data;

  if (cutId === addId) {
    return { success: false, error: "Choose a different player to cut." };
  }

  const context = await getRosterActionContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { season, team, league, user } = context;

  const cutPrepared = await prepareCut(context, cutId, {
    skipRosterMinimumCheck: true,
  });
  if ("error" in cutPrepared) {
    return { success: false, error: cutPrepared.error };
  }

  const addPrepared = await prepareAdd(context, addId, {
    excludeRosterRowId: cutPrepared.row.id,
  });
  if (!addPrepared.ok) {
    return addPrepared.result;
  }

  const rules = resolveTransactionRules(season.settings.transactionRules);
  if (rules.enforceRosterMinimums) {
    const rostered = await listRosteredPlayers(team.id);
    if (
      wouldBreachRosterMinimums({
        roster: rostered,
        removeIds: [cutId],
        add: [
          {
            id: addId,
            primaryPositionId: addPrepared.player.primaryPositionId,
            slotPositionId: null,
          },
        ],
        rosterSlots: season.settings.rosterSlots,
        enforce: true,
      })
    ) {
      return {
        success: false,
        error:
          firstRosterMinimumError(
            simulateRosterAfterMutation({
              roster: rostered,
              removeIds: [cutId],
              add: [
                {
                  id: addId,
                  primaryPositionId: addPrepared.player.primaryPositionId,
                  slotPositionId: null,
                },
              ],
            }),
            season.settings.rosterSlots,
            true,
          ) ?? "This cut would leave you under a roster minimum.",
      };
    }
  }

  const cutClearsAt = dropWaiverClearsAt(cutPrepared.wire);

  await db.transaction(async (tx) => {
    await waiveOrDeleteRosterRow({
      rowId: cutPrepared.row.id,
      waiversEnabled: season.waiversEnabled,
      dropWaiverHours: cutPrepared.wire.dropWaiverHours,
      skipWaivers: cutPrepared.skipWaivers,
      waiverClearsAt: cutClearsAt,
      client: tx,
    });
    await insertOrRestoreRosteredPlayer({
      leagueSeasonId: season.id,
      teamId: team.id,
      playerId: addId,
      slotPositionId: addPrepared.slotPositionId,
      seasonRows: addPrepared.seasonRows,
      now: addPrepared.now,
      client: tx,
    });
  });

  const activityAt = new Date();
  await logLeagueActivity({
    leagueSeasonId: season.id,
    type: "player_dropped",
    teamId: team.id,
    actorUserId: user.id,
    playerId: cutId,
    summary: `${team.name} dropped ${cutPrepared.row.fullName}`,
    metadata: { playerName: cutPrepared.row.fullName, teamName: team.name },
    createdAt: activityAt,
  });
  await logLeagueActivity({
    leagueSeasonId: season.id,
    type: "player_added",
    teamId: team.id,
    actorUserId: user.id,
    playerId: addPrepared.player.id,
    summary: `${team.name} added ${addPrepared.player.fullName}`,
    metadata: { playerName: addPrepared.player.fullName, teamName: team.name },
    createdAt: activityAt,
  });
  await logReservePlacementFromAcquisition({
    leagueSeasonId: season.id,
    teamId: team.id,
    actorUserId: user.id,
    playerId: addPrepared.player.id,
    slotPositionId: addPrepared.slotPositionId,
    teamName: team.name,
    playerName: addPrepared.player.fullName,
    createdAt: activityAt,
  });

  revalidateRosterPaths(league.publicId);
  return { success: true, playerName: addPrepared.player.fullName };
}

export async function assignPlayerSlot(
  slug: string,
  playerId: string,
  slotPositionId: string,
): Promise<RosterActionResult> {
  const parsed = assignSlotSchema.safeParse({ playerId, slotPositionId });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid player or slot.",
    };
  }

  const { playerId: pid, slotPositionId: sid } = parsed.data;

  const context = await getLineupActionContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { season, team, league, user } = context;
  const irEligibleStatuses = resolveIrEligibleStatuses(
    season.settings.irEligibleStatuses,
  );
  const taxiMaxYearsExp = resolveTaxiMaxYearsExp(
    season.settings.taxiMaxYearsExp,
  );
  const taxiPreventReaddAfterActivation =
    resolveTaxiPreventReaddAfterActivation(
      season.settings.taxiPreventReaddAfterActivation,
    );
  const rosteredOnTeam = await listRosteredPlayers(team.id);
  const applied = applyLocalSlotAssignment(
    rosteredOnTeam,
    pid,
    sid,
    season.settings.rosterSlots,
    season.benchSlots,
    irEligibleStatuses,
    taxiMaxYearsExp,
    taxiPreventReaddAfterActivation,
  );

  if ("error" in applied) {
    return { success: false, error: applied.error };
  }

  const lockError = await assertLineupLockAllowsChanges({
    seasonSettings: season.settings,
    current: rosteredOnTeam,
    next: applied.players,
  });
  if (lockError) {
    return { success: false, error: lockError };
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
  const parsed = rosterSlotsSchema.safeParse({ slotAssignments: assignments });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid roster assignments.",
    };
  }

  const validated = parsed.data.slotAssignments;
  if (validated.length === 0) {
    return { success: false, error: "No roster changes to save." };
  }

  const context = await getLineupActionContext(slug);
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
    assignments: validated,
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
    /** Commissioner can override lineup locks. */
    bypassLineupLock: true,
  });
}

async function assertLineupLockAllowsChanges(input: {
  seasonSettings: {
    lineupLockMode?: string | null;
    transactionRules?: Parameters<typeof resolveTransactionRules>[0];
  };
  current: Array<{
    id: string;
    fullName: string;
    nflTeam: string | null;
    slotPositionId: string | null;
    primaryPositionId: string;
  }>;
  next: Array<{
    id: string;
    fullName: string;
    nflTeam: string | null;
    slotPositionId: string | null;
    primaryPositionId: string;
  }>;
}): Promise<string | null> {
  const mode = parseLineupLockMode(input.seasonSettings.lineupLockMode);
  const rules = resolveTransactionRules(input.seasonSettings.transactionRules);
  const currentById = new Map(input.current.map((row) => [row.id, row]));
  const changes = input.next.flatMap((player) => {
    const previous = currentById.get(player.id);
    if (!previous) return [];
    const previousSlot = previous.slotPositionId ?? previous.primaryPositionId;
    const nextSlot = player.slotPositionId ?? player.primaryPositionId;
    if (previousSlot === nextSlot) return [];
    return [
      {
        fullName: player.fullName,
        nflTeam: player.nflTeam,
        previousSlot,
        nextSlot,
      },
    ];
  });
  if (changes.length === 0) {
    return null;
  }

  const startedTeams = await loadStartedNflTeamsForLineupLock();
  if (!startedTeams) {
    // Fail open if scoreboard is unavailable — same posture as acquisition locks.
    return null;
  }

  const gameStartBlocked = findBlockedGameStartMoves({
    preventCutsAfterGameStart: rules.preventCutsAfterGameStart,
    startedTeams,
    changes,
  });
  if (gameStartBlocked) {
    return gameStartBlocked;
  }

  return findBlockedLineupMoves({ mode, startedTeams, changes });
}

async function applyRosterSlotAssignments(input: {
  leagueSlug: string;
  season: {
    id: string;
    settings: {
      rosterSlots: Parameters<typeof getSlotCapacity>[0];
      irEligibleStatuses?: string[] | null;
      lineupLockMode?: string | null;
      taxiMaxYearsExp?: 0 | 1 | 2 | 3 | 4 | 5 | null;
      taxiPreventReaddAfterActivation?: boolean;
      transactionRules?: Parameters<typeof resolveTransactionRules>[0];
    };
    benchSlots: number;
  };
  teamId: string;
  teamName: string;
  actorUserId: string;
  assignments: Array<{ playerId: string; slotPositionId: string }>;
  notOnRosterError: string;
  bypassLineupLock?: boolean;
}): Promise<RosterActionResult> {
  const {
    leagueSlug,
    season,
    teamId,
    teamName,
    actorUserId,
    assignments,
    notOnRosterError,
    bypassLineupLock = false,
  } = input;
  const irEligibleStatuses = resolveIrEligibleStatuses(
    season.settings.irEligibleStatuses,
  );
  const taxiMaxYearsExp = resolveTaxiMaxYearsExp(
    season.settings.taxiMaxYearsExp,
  );
  const taxiPreventReaddAfterActivation =
    resolveTaxiPreventReaddAfterActivation(
      season.settings.taxiPreventReaddAfterActivation,
    );
  const rosteredOnTeam = await listRosteredPlayers(teamId);
  const byId = new Map(rosteredOnTeam.map((row) => [row.id, row]));
  const assignmentById = new Map(
    assignments.map((row) => [row.playerId, row.slotPositionId]),
  );

  const nextPlayers = rosteredOnTeam.map((row) => {
    const nextSlot = assignmentById.get(row.id);
    const previousSlot = row.slotPositionId ?? row.primaryPositionId;
    const slotPositionId = nextSlot ?? previousSlot;
    return {
      ...row,
      slotPositionId,
      taxiActivated:
        previousSlot === "TAXI" && slotPositionId !== "TAXI"
          ? true
          : row.taxiActivated,
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
    const movingOntoTaxi =
      slotPositionId === "TAXI" && previousSlot !== "TAXI";

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

    if (movingOntoTaxi) {
      if (
        !canMovePlayerToTaxi({
          preventReaddAfterActivation: taxiPreventReaddAfterActivation,
          taxiActivated: current.taxiActivated,
          currentSlotPositionId: current.slotPositionId,
        })
      ) {
        return {
          success: false,
          error: TAXI_ACTIVATED_BLOCK_MESSAGE,
        };
      }
      if (
        !slotAcceptsPlayer("TAXI", player.primaryPositionId, {
          yearsExp: player.yearsExp,
          taxiMaxYearsExp,
        })
      ) {
        return {
          success: false,
          error: `${player.fullName} is not eligible for Taxi.`,
        };
      }
      continue;
    }

    if (slotPositionId === "IR" || slotPositionId === "TAXI") {
      continue;
    }

    if (
      !slotAcceptsPlayer(slotPositionId, player.primaryPositionId, {
        injuryStatus: player.injuryStatus,
        irEligibleStatuses,
        yearsExp: player.yearsExp,
        taxiMaxYearsExp,
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

  if (!bypassLineupLock) {
    const lockError = await assertLineupLockAllowsChanges({
      seasonSettings: season.settings,
      current: rosteredOnTeam,
      next: nextPlayers,
    });
    if (lockError) {
      return { success: false, error: lockError };
    }
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
      const leavingTaxi =
        row.previousSlot === "TAXI" && row.slotPositionId !== "TAXI";
      await tx
        .update(rosterPlayers)
        .set({
          slotPositionId: row.slotPositionId,
          ...(leavingTaxi ? { taxiActivated: true } : {}),
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
        summary: `${activity.teamName} moved ${row.fullName} to their taxi squad`,
      });
    }
    if (row.previousSlot === "TAXI" && row.slotPositionId !== "TAXI") {
      events.push({
        type: "taxi_removed",
        summary: `${activity.teamName} moved ${row.fullName} to their active roster`,
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
