"use server";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  players,
  rosterPlayers,
  teams,
  waiverClaims,
  leagueActivity,
  leagues,
  leagueSeasons,
} from "@/db/schema";
import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { requireSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  createNotifications,
  transactionsHref,
  type CreateNotificationInput,
} from "@/lib/notifications/create";
import { isRosterTransactionsEnabled } from "@/lib/leagues/free-agency";
import {
  formatIrLockMessage,
  getIrLockViolations,
} from "@/lib/leagues/ir-lock";
import { resolveIrEligibleStatuses } from "@/lib/leagues/ir-eligibility";
import {
  countActivePositionPlayers,
  countActiveRosterPlayers,
  countsTowardRosterMax,
  getMaxRosterSize,
  getPositionRosterMax,
} from "@/lib/leagues/roster-capacity";
import {
  pickDefaultSlotPosition,
} from "@/lib/leagues/roster-slots";
import { getAcquisitionKind } from "@/lib/leagues/waivers/acquisition";
import {
  adjudicateWaiverClaims,
  moveWinnersToBottom,
  type PendingClaimForProcess,
} from "@/lib/leagues/waivers/adjudicate";
import {
  buildWaiverActivityMetadata,
  formatWaiverAwardSummary,
  formatWaiverFailSummary,
} from "@/lib/leagues/waivers/activity";
import {
  getFantasyWeekStartUtc,
  isWaiverProcessDue,
} from "@/lib/leagues/waivers/calendar";
import {
  seasonUsesFaab,
} from "@/lib/leagues/waivers/faab";
import {
  getStartedNflTeamAbbreviations,
  hasNflTeamStarted,
} from "@/lib/leagues/waivers/game-lock";
import { resolveWaiverWireSettings } from "@/lib/leagues/waiver-wire";
import { getNflScoreboard } from "@/lib/espn/scoreboard";
import { getNflState } from "@/lib/sleeper/api";
import {
  getLeagueBySlug,
  getLeagueMembership,
  getLeagueSeason,
} from "@/lib/queries/leagues";
import { getUserTeamForSeason } from "@/lib/queries/watchlist";

export type WaiverActionResult = {
  success: boolean;
  error?: string;
  awarded?: number;
  failed?: number;
  playerName?: string;
};

function revalidateWaiverPaths(slug: string) {
  revalidatePath(`/league/${slug}`);
  revalidatePath(`/league/${slug}/players`);
  revalidatePath(`/league/${slug}/team`);
  revalidatePath(`/league/${slug}/activity`);
  revalidatePath(`/league/${slug}/settings/waivers`);
}

async function listRosteredPlayers(teamId: string) {
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

async function assertIrAcquisitionsAllowed(
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

async function findSeasonRosterRows(leagueSeasonId: string, playerId: string) {
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

function occupiedBySlot(
  rows: Array<{ slotPositionId: string | null; primaryPositionId: string }>,
) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const slot = row.slotPositionId ?? row.primaryPositionId;
    map.set(slot, (map.get(slot) ?? 0) + 1);
  }
  return map;
}

async function insertOrRestoreRosteredPlayer(input: {
  teamId: string;
  playerId: string;
  slotPositionId: string;
  seasonRows: Awaited<ReturnType<typeof findSeasonRosterRows>>;
  now: number;
}) {
  const acquiredAt = new Date();
  const ownWaived = input.seasonRows.find(
    (row) => row.teamId === input.teamId && row.status === "waived",
  );

  await db.transaction(async (tx) => {
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
          acquiredAt,
          updatedAt: new Date(),
        })
        .where(eq(rosterPlayers.id, ownWaived.id));
      return;
    }

    await tx.insert(rosterPlayers).values({
      teamId: input.teamId,
      playerId: input.playerId,
      status: "rostered",
      slotPositionId: input.slotPositionId,
      waiverClearsAt: null,
      acquiredAt,
    });
  });
}

async function waiveOrDeleteRosterRow(input: {
  rowId: string;
  waiversEnabled: boolean;
  dropWaiverHours: number;
  skipWaivers?: boolean;
}) {
  if (!input.waiversEnabled || input.skipWaivers) {
    await db.delete(rosterPlayers).where(eq(rosterPlayers.id, input.rowId));
    return;
  }

  const waiverClearsAt = new Date(
    Date.now() + input.dropWaiverHours * 60 * 60 * 1000,
  );

  await db
    .update(rosterPlayers)
    .set({
      status: "waived",
      waiverClearsAt,
      slotPositionId: null,
      updatedAt: new Date(),
    })
    .where(eq(rosterPlayers.id, input.rowId));
}

async function ensureTeamFaabRemaining(input: {
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

export type ClaimContextResult =
  | {
      success: true;
      playerName: string;
      cutCandidates: Array<{
        id: string;
        fullName: string;
        nflTeam: string | null;
        primaryPositionId: string;
      }>;
      requiresDrop: boolean;
      waiverType: "priority" | "faab";
      faabRemaining: number | null;
      allowZeroBids: boolean;
    }
  | { success: false; error: string };

/** Load claim dialog context for a free / waived player. */
export async function getClaimContext(
  slug: string,
  playerId: string,
): Promise<ClaimContextResult> {
  if (!playerId) {
    return { success: false, error: "Missing player." };
  }

  const user = await requireSessionUser();
  const league = await getLeagueBySlug(slug);
  if (!league) {
    return { success: false, error: "League not found." };
  }

  const membership = await getLeagueMembership(league.id, user.id);
  if (!membership) {
    return { success: false, error: "You are not a member of this league." };
  }

  const season = await getLeagueSeason(league.id);
  if (!season) {
    return { success: false, error: "League season not found." };
  }

  if (!season.waiversEnabled) {
    return { success: false, error: "Waivers are disabled." };
  }

  if (!isRosterTransactionsEnabled(season)) {
    return { success: false, error: "Free agency is closed." };
  }

  const team = await getUserTeamForSeason(season.id, user.id);
  if (!team) {
    return { success: false, error: "Team not found." };
  }

  const [player] = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      primaryPositionId: players.primaryPositionId,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (!player) {
    return { success: false, error: "Player not found." };
  }

  const rosteredOnTeam = await listRosteredPlayers(team.id);
  const maxRoster = getMaxRosterSize(
    season.settings.rosterSlots,
    season.benchSlots,
  );
  const requiresDrop = countActiveRosterPlayers(rosteredOnTeam) >= maxRoster;

  const cutCandidates = rosteredOnTeam
    .filter((row) =>
      countsTowardRosterMax(row.slotPositionId, row.primaryPositionId),
    )
    .map((row) => ({
      id: row.id,
      fullName: row.fullName,
      nflTeam: row.nflTeam,
      primaryPositionId: row.primaryPositionId,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const wire = resolveWaiverWireSettings(season.settings.waiverWire);
  const faabRemaining = await ensureTeamFaabRemaining({
    teamId: team.id,
    faabRemaining: team.faabRemaining,
    season,
  });

  return {
    success: true,
    playerName: player.fullName,
    cutCandidates,
    requiresDrop,
    waiverType: season.waiverType,
    faabRemaining,
    allowZeroBids: wire.allowZeroBids,
  };
}

export async function fileWaiverClaim(
  slug: string,
  input: {
    playerId: string;
    bid?: number | null;
    dropPlayerId?: string | null;
  },
): Promise<WaiverActionResult> {
  const playerId = input.playerId?.trim();
  if (!playerId) {
    return { success: false, error: "Missing player." };
  }

  const user = await requireSessionUser();
  const league = await getLeagueBySlug(slug);
  if (!league) {
    return { success: false, error: "League not found." };
  }

  const membership = await getLeagueMembership(league.id, user.id);
  if (!membership) {
    return { success: false, error: "You are not a member of this league." };
  }

  const season = await getLeagueSeason(league.id);
  if (!season) {
    return { success: false, error: "League season not found." };
  }

  if (!isRosterTransactionsEnabled(season)) {
    return { success: false, error: "Free agency is closed." };
  }

  if (!season.waiversEnabled) {
    return {
      success: false,
      error: "Waivers are disabled. Add the player as a free agent instead.",
    };
  }

  const team = await getUserTeamForSeason(season.id, user.id);
  if (!team) {
    return { success: false, error: "Team not found." };
  }

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
      nflTeam: players.nflTeam,
      injuryStatus: players.injuryStatus,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (!player) {
    return { success: false, error: "Player not found." };
  }

  const now = Date.now();
  const wire = resolveWaiverWireSettings(season.settings.waiverWire);
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

  let gameStartedThisWeek = false;
  if (wire.waiverPool === "drops_and_free_agents" && player.nflTeam) {
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

  const kind = getAcquisitionKind({
    waiversEnabled: season.waiversEnabled,
    waiverWire: wire,
    rosterTransactionsEnabled: true,
    ownership: { fantasyTeamId: null, onWaivers },
    gameStartedThisWeek,
  });

  if (kind !== "claim") {
    return {
      success: false,
      error:
        kind === "add"
          ? "This player is a free agent. Use Add instead of Claim."
          : "This player cannot be claimed right now.",
    };
  }

  const rosteredOnTeam = await listRosteredPlayers(team.id);
  const maxRoster = getMaxRosterSize(
    season.settings.rosterSlots,
    season.benchSlots,
  );
  const activeCount = countActiveRosterPlayers(rosteredOnTeam);
  const needsDrop = activeCount >= maxRoster;

  const dropPlayerId = input.dropPlayerId?.trim() || null;
  if (needsDrop && !dropPlayerId) {
    return {
      success: false,
      error: "Roster is full. Choose a player to drop with this claim.",
    };
  }

  if (dropPlayerId) {
    if (dropPlayerId === playerId) {
      return { success: false, error: "Choose a different player to drop." };
    }
    const dropOnRoster = rosteredOnTeam.find((row) => row.id === dropPlayerId);
    if (!dropOnRoster) {
      return { success: false, error: "Drop player is not on your roster." };
    }
    if (
      !countsTowardRosterMax(
        dropOnRoster.slotPositionId,
        dropOnRoster.primaryPositionId,
      )
    ) {
      // IR/Taxi drops don't free a roster spot for max-size.
      if (needsDrop) {
        return {
          success: false,
          error: "Choose a player who counts toward roster size to drop.",
        };
      }
    }
  }

  let bid: number | null = null;
  if (season.waiverType === "faab") {
    const rawBid = input.bid;
    if (rawBid == null || !Number.isFinite(rawBid)) {
      return { success: false, error: "Enter a FAAB bid." };
    }
    bid = Math.floor(rawBid);
    if (bid < 0) {
      return { success: false, error: "Bid cannot be negative." };
    }
    if (bid === 0 && !wire.allowZeroBids) {
      return { success: false, error: "Zero-dollar bids are not allowed." };
    }
    const remaining = await ensureTeamFaabRemaining({
      teamId: team.id,
      faabRemaining: team.faabRemaining,
      season,
    });
    if (bid > (remaining ?? 0)) {
      return {
        success: false,
        error: `Bid exceeds your remaining FAAB ($${remaining ?? 0}).`,
      };
    }
  }

  const [existing] = await db
    .select({ id: waiverClaims.id })
    .from(waiverClaims)
    .where(
      and(
        eq(waiverClaims.teamId, team.id),
        eq(waiverClaims.playerId, playerId),
        eq(waiverClaims.status, "pending"),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(waiverClaims)
      .set({
        bid,
        dropPlayerId,
        updatedAt: new Date(),
      })
      .where(eq(waiverClaims.id, existing.id));
  } else {
    const [maxRow] = await db
      .select({
        value: sql<number>`coalesce(max(${waiverClaims.sortOrder}), 0)`,
      })
      .from(waiverClaims)
      .where(
        and(
          eq(waiverClaims.teamId, team.id),
          eq(waiverClaims.status, "pending"),
        ),
      );

    await db.insert(waiverClaims).values({
      leagueSeasonId: season.id,
      teamId: team.id,
      playerId,
      dropPlayerId,
      bid,
      sortOrder: Number(maxRow?.value ?? 0) + 1,
      status: "pending",
    });
  }

  revalidateWaiverPaths(league.publicId);
  return { success: true, playerName: player.fullName };
}

export async function cancelWaiverClaim(
  slug: string,
  claimId: string,
): Promise<WaiverActionResult> {
  if (!claimId) {
    return { success: false, error: "Missing claim." };
  }

  const user = await requireSessionUser();
  const league = await getLeagueBySlug(slug);
  if (!league) {
    return { success: false, error: "League not found." };
  }

  const membership = await getLeagueMembership(league.id, user.id);
  if (!membership) {
    return { success: false, error: "You are not a member of this league." };
  }

  const season = await getLeagueSeason(league.id);
  if (!season) {
    return { success: false, error: "League season not found." };
  }

  const team = await getUserTeamForSeason(season.id, user.id);
  if (!team) {
    return { success: false, error: "Team not found." };
  }

  const [claim] = await db
    .select({
      id: waiverClaims.id,
      status: waiverClaims.status,
      playerName: players.fullName,
    })
    .from(waiverClaims)
    .innerJoin(players, eq(waiverClaims.playerId, players.id))
    .where(
      and(eq(waiverClaims.id, claimId), eq(waiverClaims.teamId, team.id)),
    )
    .limit(1);

  if (!claim) {
    return { success: false, error: "Claim not found." };
  }
  if (claim.status !== "pending") {
    return { success: false, error: "Only pending claims can be cancelled." };
  }

  await db
    .update(waiverClaims)
    .set({
      status: "cancelled",
      processedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(waiverClaims.id, claim.id));

  revalidateWaiverPaths(league.publicId);
  return { success: true, playerName: claim.playerName };
}

export async function reorderWaiverClaims(
  slug: string,
  claimIds: string[],
): Promise<WaiverActionResult> {
  if (claimIds.length === 0) {
    return { success: false, error: "Nothing to reorder." };
  }

  const user = await requireSessionUser();
  const league = await getLeagueBySlug(slug);
  if (!league) {
    return { success: false, error: "League not found." };
  }

  const membership = await getLeagueMembership(league.id, user.id);
  if (!membership) {
    return { success: false, error: "You are not a member of this league." };
  }

  const season = await getLeagueSeason(league.id);
  if (!season) {
    return { success: false, error: "League season not found." };
  }

  const team = await getUserTeamForSeason(season.id, user.id);
  if (!team) {
    return { success: false, error: "Team not found." };
  }

  const existing = await db
    .select({ id: waiverClaims.id })
    .from(waiverClaims)
    .where(
      and(
        eq(waiverClaims.teamId, team.id),
        eq(waiverClaims.status, "pending"),
      ),
    );

  const existingIds = new Set(existing.map((row) => row.id));
  if (
    claimIds.length !== existingIds.size ||
    claimIds.some((id) => !existingIds.has(id))
  ) {
    return {
      success: false,
      error: "Claims are out of date. Refresh and try again.",
    };
  }

  const now = new Date();
  for (let index = 0; index < claimIds.length; index++) {
    await db
      .update(waiverClaims)
      .set({ sortOrder: index + 1, updatedAt: now })
      .where(
        and(
          eq(waiverClaims.id, claimIds[index]!),
          eq(waiverClaims.teamId, team.id),
        ),
      );
  }

  revalidateWaiverPaths(league.publicId);
  return { success: true };
}

export async function updateWaiverClaimBid(
  slug: string,
  claimId: string,
  bidInput: number,
): Promise<WaiverActionResult> {
  if (!claimId) {
    return { success: false, error: "Missing claim." };
  }

  const user = await requireSessionUser();
  const league = await getLeagueBySlug(slug);
  if (!league) {
    return { success: false, error: "League not found." };
  }

  const membership = await getLeagueMembership(league.id, user.id);
  if (!membership) {
    return { success: false, error: "You are not a member of this league." };
  }

  const season = await getLeagueSeason(league.id);
  if (!season) {
    return { success: false, error: "League season not found." };
  }

  if (season.waiverType !== "faab") {
    return { success: false, error: "This league does not use FAAB." };
  }

  const team = await getUserTeamForSeason(season.id, user.id);
  if (!team) {
    return { success: false, error: "Team not found." };
  }

  const wire = resolveWaiverWireSettings(season.settings.waiverWire);

  if (!Number.isFinite(bidInput)) {
    return { success: false, error: "Enter a FAAB bid." };
  }
  const bid = Math.floor(bidInput);
  if (bid < 0) {
    return { success: false, error: "Bid cannot be negative." };
  }
  if (bid === 0 && !wire.allowZeroBids) {
    return { success: false, error: "Zero-dollar bids are not allowed." };
  }

  const remaining = await ensureTeamFaabRemaining({
    teamId: team.id,
    faabRemaining: team.faabRemaining,
    season,
  });
  if (bid > (remaining ?? 0)) {
    return {
      success: false,
      error: `Bid exceeds your remaining FAAB ($${remaining ?? 0}).`,
    };
  }

  const [claim] = await db
    .select({
      id: waiverClaims.id,
      status: waiverClaims.status,
      playerName: players.fullName,
    })
    .from(waiverClaims)
    .innerJoin(players, eq(waiverClaims.playerId, players.id))
    .where(
      and(eq(waiverClaims.id, claimId), eq(waiverClaims.teamId, team.id)),
    )
    .limit(1);

  if (!claim) {
    return { success: false, error: "Claim not found." };
  }
  if (claim.status !== "pending") {
    return { success: false, error: "Only pending claims can be edited." };
  }

  await db
    .update(waiverClaims)
    .set({
      bid,
      updatedAt: new Date(),
    })
    .where(eq(waiverClaims.id, claim.id));

  revalidateWaiverPaths(league.publicId);
  return { success: true, playerName: claim.playerName };
}

export async function markWaiverResultsSeen(
  slug: string,
): Promise<WaiverActionResult> {
  const user = await requireSessionUser();
  const league = await getLeagueBySlug(slug);
  if (!league) {
    return { success: false, error: "League not found." };
  }

  const membership = await getLeagueMembership(league.id, user.id);
  if (!membership) {
    return { success: false, error: "You are not a member of this league." };
  }

  const season = await getLeagueSeason(league.id);
  if (!season) {
    return { success: false, error: "League season not found." };
  }

  const team = await getUserTeamForSeason(season.id, user.id);
  if (!team) {
    return { success: false, error: "Team not found." };
  }

  await db
    .update(teams)
    .set({ lastWaiverResultsSeenAt: new Date() })
    .where(eq(teams.id, team.id));

  revalidatePath(`/league/${slug}/team`);
  return { success: true };
}

export async function processWaiverClaimsNow(
  slug: string,
): Promise<WaiverActionResult> {
  const user = await requireSessionUser();
  const league = await getLeagueBySlug(slug);
  if (!league) {
    return { success: false, error: "League not found." };
  }

  const membership = await getLeagueMembership(league.id, user.id);
  if (!membership || membership.role !== "commissioner") {
    return { success: false, error: "Only the commissioner can process waivers." };
  }

  const season = await getLeagueSeason(league.id);
  if (!season) {
    return { success: false, error: "League season not found." };
  }

  if (!season.waiversEnabled) {
    return { success: false, error: "Waivers are disabled for this league." };
  }

  const result = await processSeasonWaivers({
    season,
    leagueSlug: league.publicId,
  });

  return {
    success: true,
    awarded: result.awarded,
    failed: result.failed,
  };
}

/** Cron entrypoint: process every season currently inside its 10:00 UTC window window. */
export async function processAllDueWaivers(now: Date = new Date()): Promise<{
  checked: number;
  processed: number;
  results: Array<{
    seasonId: string;
    slug: string;
    awarded: number;
    failed: number;
  }>;
}> {
  const seasons = await db
    .select({
      id: leagueSeasons.id,
      leagueId: leagueSeasons.leagueId,
      waiversEnabled: leagueSeasons.waiversEnabled,
      waiverType: leagueSeasons.waiverType,
      faabBudget: leagueSeasons.faabBudget,
      benchSlots: leagueSeasons.benchSlots,
      irEnabled: leagueSeasons.irEnabled,
      taxiEnabled: leagueSeasons.taxiEnabled,
      settings: leagueSeasons.settings,
      lastWaiverProcessedAt: leagueSeasons.lastWaiverProcessedAt,
      slug: leagues.slug,
      publicId: leagues.publicId,
    })
    .from(leagueSeasons)
    .innerJoin(leagues, eq(leagueSeasons.leagueId, leagues.id))
    .where(eq(leagueSeasons.waiversEnabled, true));

  const results: Array<{
    seasonId: string;
    slug: string;
    awarded: number;
    failed: number;
  }> = [];

  for (const season of seasons) {
    const wire = resolveWaiverWireSettings(
      (season.settings as LeagueSeasonSettings | null)?.waiverWire,
    );
    if (
      !isWaiverProcessDue({
        processDays: wire.processDays,
        lastWaiverProcessedAt: season.lastWaiverProcessedAt,
        now,
      })
    ) {
      continue;
    }

    const result = await processSeasonWaivers({
      season: {
        ...season,
        settings: season.settings as LeagueSeasonSettings,
      },
      leagueSlug: season.publicId,
      now,
    });
    results.push({
      seasonId: season.id,
      slug: season.publicId,
      awarded: result.awarded,
      failed: result.failed,
    });
  }

  return {
    checked: seasons.length,
    processed: results.length,
    results,
  };
}

type ProcessableSeason = {
  id: string;
  waiversEnabled: boolean;
  waiverType: "priority" | "faab";
  faabBudget: number | null;
  benchSlots: number;
  irEnabled: boolean;
  taxiEnabled: boolean;
  settings: LeagueSeasonSettings;
  lastWaiverProcessedAt?: Date | null;
};

async function processSeasonWaivers(input: {
  season: ProcessableSeason;
  leagueSlug: string;
  now?: Date;
}): Promise<{ awarded: number; failed: number }> {
  const { season, leagueSlug } = input;
  const wire = resolveWaiverWireSettings(season.settings.waiverWire);
  const now = input.now ?? new Date();

  const teamRows = await db
    .select({
      id: teams.id,
      waiverPriority: teams.waiverPriority,
      faabRemaining: teams.faabRemaining,
      createdAt: teams.createdAt,
    })
    .from(teams)
    .where(eq(teams.leagueSeasonId, season.id))
    .orderBy(asc(teams.waiverPriority), asc(teams.createdAt));

  // One-time repair: unique priorities if everyone is still on the default (1).
  const uniquePriorities = new Set(teamRows.map((row) => row.waiverPriority));
  if (teamRows.length > 1 && uniquePriorities.size === 1) {
    const ordered = [...teamRows].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    for (let index = 0; index < ordered.length; index++) {
      const row = ordered[index]!;
      const priority = index + 1;
      await db
        .update(teams)
        .set({ waiverPriority: priority })
        .where(eq(teams.id, row.id));
      row.waiverPriority = priority;
    }
  }

  // Seed any null FAAB balances from the season budget (one-time).
  if (seasonUsesFaab(season)) {
    for (const row of teamRows) {
      if (row.faabRemaining != null) continue;
      const seeded = season.faabBudget!;
      await db
        .update(teams)
        .set({ faabRemaining: seeded })
        .where(eq(teams.id, row.id));
      row.faabRemaining = seeded;
    }
  }

  // Weekly reset: first process of the fantasy week re-numbers by current order.
  if (wire.resetOrderWeekly) {
    const weekStart = getFantasyWeekStartUtc(now);
    const alreadyProcessedThisWeek =
      season.lastWaiverProcessedAt != null &&
      season.lastWaiverProcessedAt >= weekStart;
    if (!alreadyProcessedThisWeek && teamRows.length > 0) {
      const renumbered = teamRows.map((row, index) => ({
        teamId: row.id,
        waiverPriority: index + 1,
      }));
      for (const row of renumbered) {
        await db
          .update(teams)
          .set({ waiverPriority: row.waiverPriority })
          .where(eq(teams.id, row.teamId));
        const match = teamRows.find((t) => t.id === row.teamId);
        if (match) match.waiverPriority = row.waiverPriority;
      }
    }
  }

  const pending = await db
    .select({
      id: waiverClaims.id,
      teamId: waiverClaims.teamId,
      playerId: waiverClaims.playerId,
      dropPlayerId: waiverClaims.dropPlayerId,
      bid: waiverClaims.bid,
      createdAt: waiverClaims.createdAt,
      sortOrder: waiverClaims.sortOrder,
      waiverPriority: teams.waiverPriority,
      faabRemaining: teams.faabRemaining,
    })
    .from(waiverClaims)
    .innerJoin(teams, eq(waiverClaims.teamId, teams.id))
    .where(
      and(
        eq(waiverClaims.leagueSeasonId, season.id),
        eq(waiverClaims.status, "pending"),
      ),
    );

  let awarded = 0;
  let failed = 0;

  if (pending.length > 0) {
    const teamNameById = new Map(
      (
        await db
          .select({ id: teams.id, name: teams.name, userId: teams.userId })
          .from(teams)
          .where(eq(teams.leagueSeasonId, season.id))
      ).map((row) => [row.id, row]),
    );

    const playerIds = [
      ...new Set([
        ...pending.map((row) => row.playerId),
        ...pending
          .map((row) => row.dropPlayerId)
          .filter((id): id is string => Boolean(id)),
      ]),
    ];
    const playerNameById = new Map(
      (
        await db
          .select({ id: players.id, fullName: players.fullName })
          .from(players)
          .where(inArray(players.id, playerIds))
      ).map((row) => [row.id, row.fullName]),
    );

    const claimsForProcess: PendingClaimForProcess[] = pending.map((row) => ({
      id: row.id,
      teamId: row.teamId,
      playerId: row.playerId,
      dropPlayerId: row.dropPlayerId,
      bid: row.bid,
      createdAt: row.createdAt,
      sortOrder: row.sortOrder,
      waiverPriority: row.waiverPriority,
      faabRemaining: row.faabRemaining,
    }));

    const adjudication = adjudicateWaiverClaims({
      claims: claimsForProcess,
      waiverType: season.waiverType,
    });

    const claimById = new Map(pending.map((row) => [row.id, row]));
    const successfulWinners: string[] = [];
    const notificationRows: CreateNotificationInput[] = [];
    const href = transactionsHref(leagueSlug);

    for (const outcome of adjudication.outcomes) {
      const claim = claimById.get(outcome.claimId);
      if (!claim) continue;

      const teamInfo = teamNameById.get(claim.teamId);
      const teamName = teamInfo?.name?.trim() || "A team";
      const playerName = playerNameById.get(claim.playerId) ?? "a player";
      const dropPlayerName = claim.dropPlayerId
        ? (playerNameById.get(claim.dropPlayerId) ?? null)
        : null;

      if (outcome.status === "failed") {
        const failReason = outcome.failReason?.trim() || "Claim failed.";
        await db
          .update(waiverClaims)
          .set({
            status: "failed",
            failReason,
            processedAt: now,
            updatedAt: now,
          })
          .where(eq(waiverClaims.id, claim.id));
        const failSummary = formatWaiverFailSummary({
          teamName,
          playerName,
          failReason,
        });
        await db.insert(leagueActivity).values({
          leagueSeasonId: season.id,
          type: "waiver_failed",
          teamId: claim.teamId,
          actorUserId: teamInfo?.userId ?? null,
          playerId: claim.playerId,
          relatedPlayerId: claim.dropPlayerId,
          claimId: claim.id,
          summary: failSummary,
          metadata: buildWaiverActivityMetadata({
            teamName,
            playerName,
            dropPlayerName,
            bid: claim.bid,
            failReason,
            waiverType: season.waiverType,
          }),
          createdAt: now,
        });
        if (teamInfo?.userId) {
          notificationRows.push({
            recipientUserId: teamInfo.userId,
            leagueSeasonId: season.id,
            type: "waiver_processed",
            title: "Waiver claim failed",
            body: failSummary,
            href,
            claimId: claim.id,
            playerId: claim.playerId,
          });
        }
        failed += 1;
        continue;
      }

      const applyError = await applyAwardedClaim({
        season,
        wire,
        claim,
      });

      if (applyError) {
        const failReason = applyError.trim() || "Could not apply claim.";
        await db
          .update(waiverClaims)
          .set({
            status: "failed",
            failReason,
            processedAt: now,
            updatedAt: now,
          })
          .where(eq(waiverClaims.id, claim.id));
        const failSummary = formatWaiverFailSummary({
          teamName,
          playerName,
          failReason,
        });
        await db.insert(leagueActivity).values({
          leagueSeasonId: season.id,
          type: "waiver_failed",
          teamId: claim.teamId,
          actorUserId: teamInfo?.userId ?? null,
          playerId: claim.playerId,
          relatedPlayerId: claim.dropPlayerId,
          claimId: claim.id,
          summary: failSummary,
          metadata: buildWaiverActivityMetadata({
            teamName,
            playerName,
            dropPlayerName,
            bid: claim.bid,
            failReason,
            waiverType: season.waiverType,
          }),
          createdAt: now,
        });
        if (teamInfo?.userId) {
          notificationRows.push({
            recipientUserId: teamInfo.userId,
            leagueSeasonId: season.id,
            type: "waiver_processed",
            title: "Waiver claim failed",
            body: failSummary,
            href,
            claimId: claim.id,
            playerId: claim.playerId,
          });
        }
        failed += 1;
        continue;
      }

      await db
        .update(waiverClaims)
        .set({
          status: "awarded",
          failReason: null,
          processedAt: now,
          updatedAt: now,
        })
        .where(eq(waiverClaims.id, claim.id));

      const awardSummary = formatWaiverAwardSummary({
        teamName,
        playerName,
        dropPlayerName,
        bid: claim.bid,
        waiverType: season.waiverType,
      });

      await db.insert(leagueActivity).values({
        leagueSeasonId: season.id,
        type: "waiver_awarded",
        teamId: claim.teamId,
        actorUserId: teamInfo?.userId ?? null,
        playerId: claim.playerId,
        relatedPlayerId: claim.dropPlayerId,
        claimId: claim.id,
        summary: awardSummary,
        metadata: buildWaiverActivityMetadata({
          teamName,
          playerName,
          dropPlayerName,
          bid: claim.bid,
          waiverType: season.waiverType,
        }),
        createdAt: now,
      });

      if (teamInfo?.userId) {
        notificationRows.push({
          recipientUserId: teamInfo.userId,
          leagueSeasonId: season.id,
          type: "waiver_processed",
          title: "Waiver claim awarded",
          body: awardSummary,
          href,
          claimId: claim.id,
          playerId: claim.playerId,
        });
      }

      if (season.waiverType === "faab") {
        const bid = claim.bid ?? 0;
        const remaining = Math.max(0, (claim.faabRemaining ?? 0) - bid);
        await db
          .update(teams)
          .set({ faabRemaining: remaining })
          .where(eq(teams.id, claim.teamId));
        for (const row of pending) {
          if (row.teamId === claim.teamId) {
            row.faabRemaining = remaining;
          }
        }
      }

      if (!successfulWinners.includes(claim.teamId)) {
        successfulWinners.push(claim.teamId);
      }
      awarded += 1;
    }

    if (notificationRows.length > 0) {
      await createNotifications(notificationRows);
    }

    if (season.waiverType === "priority" && successfulWinners.length > 0) {
      const nextPriorities = moveWinnersToBottom(
        teamRows.map((row) => ({
          teamId: row.id,
          waiverPriority: row.waiverPriority,
        })),
        successfulWinners,
      );
      for (const row of nextPriorities) {
        await db
          .update(teams)
          .set({ waiverPriority: row.waiverPriority })
          .where(eq(teams.id, row.teamId));
      }
    }
  }

  await db
    .update(leagueSeasons)
    .set({ lastWaiverProcessedAt: now })
    .where(eq(leagueSeasons.id, season.id));

  revalidateWaiverPaths(leagueSlug);
  return { awarded, failed };
}

async function applyAwardedClaim(input: {
  season: ProcessableSeason;
  wire: ReturnType<typeof resolveWaiverWireSettings>;
  claim: {
    teamId: string;
    playerId: string;
    dropPlayerId: string | null;
  };
}): Promise<string | null> {
  const { season, wire, claim } = input;

  const seasonRows = await findSeasonRosterRows(season.id, claim.playerId);
  if (seasonRows.some((row) => row.status === "rostered")) {
    return "Player was already claimed or rostered by another team.";
  }

  const irLock = await assertIrAcquisitionsAllowed(
    claim.teamId,
    season.settings.irEligibleStatuses,
  );
  if (irLock) {
    return irLock.error;
  }

  const [player] = await db
    .select({
      id: players.id,
      primaryPositionId: players.primaryPositionId,
      injuryStatus: players.injuryStatus,
    })
    .from(players)
    .where(eq(players.id, claim.playerId))
    .limit(1);

  if (!player) {
    return "Player not found.";
  }

  let rosteredOnTeam = await listRosteredPlayers(claim.teamId);

  if (claim.dropPlayerId) {
    const dropRow = rosteredOnTeam.find((row) => row.id === claim.dropPlayerId);
    if (!dropRow) {
      return "Required drop is no longer on the roster.";
    }
    await waiveOrDeleteRosterRow({
      rowId: dropRow.rosterRowId,
      waiversEnabled: season.waiversEnabled,
      dropWaiverHours: wire.dropWaiverHours,
    });
    rosteredOnTeam = rosteredOnTeam.filter(
      (row) => row.id !== claim.dropPlayerId,
    );
  }

  const maxRoster = getMaxRosterSize(
    season.settings.rosterSlots,
    season.benchSlots,
  );
  if (countActiveRosterPlayers(rosteredOnTeam) >= maxRoster) {
    return "Roster is full after processing this claim.";
  }

  const positionMax = getPositionRosterMax(
    season.settings.rosterSlots,
    player.primaryPositionId,
  );
  const positionCount = countActivePositionPlayers(
    rosteredOnTeam,
    player.primaryPositionId,
  );
  if (
    positionMax !== Number.POSITIVE_INFINITY &&
    positionCount >= positionMax
  ) {
    return `At max ${player.primaryPositionId}s — choose a different drop.`;
  }

  await insertOrRestoreRosteredPlayer({
    teamId: claim.teamId,
    playerId: claim.playerId,
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
    now: Date.now(),
  });

  return null;
}
