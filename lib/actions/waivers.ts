"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  players,
  teams,
  waiverClaims,
} from "@/db/schema";
import { db } from "@/lib/db";
import {
  loadLeagueActionContext,
  loadLeagueMemberTeamContext,
} from "@/lib/leagues/action-context";
import {
  countActiveRosterPlayers,
  countsTowardRosterMax,
  getMaxRosterSize,
} from "@/lib/leagues/roster-capacity";
import { getAcquisitionKind } from "@/lib/leagues/waivers/acquisition";
import {
  getStartedNflTeamAbbreviations,
  hasNflTeamStarted,
} from "@/lib/leagues/waivers/game-lock";
import { processSeasonWaivers } from "@/lib/leagues/waivers/process";
import {
  assertIrAcquisitionsAllowed,
  ensureTeamFaabRemaining,
  findSeasonRosterRows,
  listRosteredPlayers,
} from "@/lib/leagues/roster-writes";
import { resolveWaiverWireSettings } from "@/lib/leagues/waiver-wire";
import { getNflScoreboard } from "@/lib/espn/scoreboard";
import { getNflState } from "@/lib/sleeper/api";

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

  const context = await loadLeagueMemberTeamContext(slug, {
    requireFreeAgencyOpen: true,
  });
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { league, season, team } = context;

  if (!season.waiversEnabled) {
    return { success: false, error: "Waivers are disabled." };
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

  const context = await loadLeagueMemberTeamContext(slug, {
    requireFreeAgencyOpen: true,
  });
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { user, league, season, team } = context;

  if (!season.waiversEnabled) {
    return {
      success: false,
      error: "Waivers are disabled. Add the player as a free agent instead.",
    };
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

  const context = await loadLeagueMemberTeamContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { league, team } = context;

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

  const context = await loadLeagueMemberTeamContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { league, team } = context;

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

  const context = await loadLeagueMemberTeamContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { league, season, team } = context;

  if (season.waiverType !== "faab") {
    return { success: false, error: "This league does not use FAAB." };
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
  const context = await loadLeagueMemberTeamContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { team } = context;

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
  const context = await loadLeagueActionContext(slug, {
    requireCommissioner: "primary",
    commissionerError: "Only the commissioner can process waivers.",
  });
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { league, season } = context;

  if (!season.waiversEnabled) {
    return { success: false, error: "Waivers are disabled for this league." };
  }

  const result = await processSeasonWaivers({
    season,
    leagueSlug: league.publicId,
  });

  revalidateWaiverPaths(league.publicId);

  return {
    success: true,
    awarded: result.awarded,
    failed: result.failed,
  };
}
