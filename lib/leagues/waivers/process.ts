import "server-only";

import { and, asc, eq, inArray, isNull, lt, or } from "drizzle-orm";

import {
  leagueActivity,
  leagueSeasons,
  players,
  teams,
  waiverClaims,
} from "@/db/schema";
import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import {
  assertActiveRosterCapacity,
  assertCutAllowedUnderLineupLock,
  pickOpenReserveAcquisitionSlot,
  resolveAcquisitionSlotPosition,
} from "@/lib/leagues/roster/acquisition";
import {
  assertReserveAcquisitionsAllowed,
  findSeasonRosterRows,
  insertOrRestoreRosteredPlayer,
  listRosteredPlayers,
  waiveOrDeleteRosterRow,
} from "@/lib/leagues/roster-writes";
import { resolveWaiverWireSettings } from "@/lib/leagues/waiver-wire";
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
  getLastProcessInstantUtc,
  isClaimEligibleForProcess,
} from "@/lib/leagues/waivers/calendar";
import { seasonUsesFaab } from "@/lib/leagues/waivers/faab";
import { announceWaiverProcessed } from "@/lib/alerts/waivers";
import { transactionsHref } from "@/lib/notifications/create";

export type ProcessableSeason = {
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

/**
 * Adjudicate pending claims, apply awards, write activity + in-app notifications,
 * rotate priority / FAAB. Caller owns path revalidation.
 */
export async function processSeasonWaivers(input: {
  season: ProcessableSeason;
  leagueSlug: string;
  now?: Date;
  /** Commissioner manual run — skip process-window lease gate. */
  force?: boolean;
}): Promise<{ awarded: number; failed: number }> {
  const { season, leagueSlug } = input;
  const wire = resolveWaiverWireSettings(season.settings.waiverWire);
  const now = input.now ?? new Date();
  const processInstant =
    getLastProcessInstantUtc(wire.processDays, now) ?? now;

  // Season-level lease so overlapping cron/manual runs don't double-adjudicate.
  if (!input.force) {
    const leaseUntil = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes
    const [leased] = await db
      .update(leagueSeasons)
      .set({ waiverProcessingLeaseUntil: leaseUntil })
      .where(
        and(
          eq(leagueSeasons.id, season.id),
          or(
            isNull(leagueSeasons.lastWaiverProcessedAt),
            lt(leagueSeasons.lastWaiverProcessedAt, processInstant),
          ),
          or(
            isNull(leagueSeasons.waiverProcessingLeaseUntil),
            lt(leagueSeasons.waiverProcessingLeaseUntil, now),
          ),
        ),
      )
      .returning({ id: leagueSeasons.id });
    if (!leased) {
      return { awarded: 0, failed: 0 };
    }
  }

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

  const pendingRows = await db
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

  const pending = pendingRows.filter((row) =>
    isClaimEligibleForProcess(row.createdAt, processInstant),
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
    const notificationRows: Array<{
      recipientUserId: string;
      title: string;
      body: string;
      claimId: string;
      playerId: string;
    }> = [];
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
        const [claimed] = await db
          .update(waiverClaims)
          .set({
            status: "failed",
            failReason,
            processedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(waiverClaims.id, claim.id),
              eq(waiverClaims.status, "pending"),
            ),
          )
          .returning({ id: waiverClaims.id });
        if (!claimed) continue;
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
            title: "Waiver claim failed",
            body: failSummary,
            claimId: claim.id,
            playerId: claim.playerId,
          });
        }
        failed += 1;
        continue;
      }

      const [awardedClaim] = await db
        .update(waiverClaims)
        .set({
          status: "awarded",
          failReason: null,
          processedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(waiverClaims.id, claim.id),
            eq(waiverClaims.status, "pending"),
          ),
        )
        .returning({ id: waiverClaims.id });
      if (!awardedClaim) continue;

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
            title: "Waiver claim failed",
            body: failSummary,
            claimId: claim.id,
            playerId: claim.playerId,
          });
        }
        failed += 1;
        continue;
      }

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
          title: "Waiver claim awarded",
          body: awardSummary,
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
      await announceWaiverProcessed(
        notificationRows.map((row) => ({
          ...row,
          leagueSeasonId: season.id,
          leaguePublicId: leagueSlug,
          href,
        })),
      );
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
    .set({
      lastWaiverProcessedAt: now,
      waiverProcessingLeaseUntil: null,
    })
    .where(eq(leagueSeasons.id, season.id));

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

  const irLock = await assertReserveAcquisitionsAllowed(
    claim.teamId,
    season.settings.irEligibleStatuses,
    season.settings.taxiMaxYearsExp,
  );
  if (irLock) {
    return irLock.error;
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
    .where(eq(players.id, claim.playerId))
    .limit(1);

  if (!player) {
    return "Player not found.";
  }

  let rosteredOnTeam = await listRosteredPlayers(claim.teamId);

  let dropRow: (typeof rosteredOnTeam)[number] | null = null;
  if (claim.dropPlayerId) {
    dropRow = rosteredOnTeam.find((row) => row.id === claim.dropPlayerId) ?? null;
    if (!dropRow) {
      return "Required drop is no longer on the roster.";
    }
    rosteredOnTeam = rosteredOnTeam.filter(
      (row) => row.id !== claim.dropPlayerId,
    );
  }

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

  const capacityError = assertActiveRosterCapacity({
    rosteredOnTeam,
    rosterSlots: season.settings.rosterSlots,
    benchSlots: season.benchSlots,
    playerPrimaryPositionId: player.primaryPositionId,
  });
  const forceReserveSlot = capacityError
    ? pickOpenReserveAcquisitionSlot(reserveArgs)
    : null;
  if (capacityError && !forceReserveSlot) {
    return capacityError;
  }

  if (dropRow) {
    const dropBlocked = await assertCutAllowedUnderLineupLock({
      lineupLockMode: season.settings.lineupLockMode,
      fullName: dropRow.fullName,
      nflTeam: dropRow.nflTeam,
      previousSlot: dropRow.slotPositionId ?? dropRow.primaryPositionId,
    });
    if (dropBlocked) {
      return dropBlocked;
    }
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
  });
  if (!slotResolved.ok) {
    return slotResolved.error;
  }
  const slotPositionId = slotResolved.slotPositionId;

  await db.transaction(async (tx) => {
    if (dropRow) {
      await waiveOrDeleteRosterRow({
        rowId: dropRow.rosterRowId,
        waiversEnabled: season.waiversEnabled,
        dropWaiverHours: wire.dropWaiverHours,
        client: tx,
      });
    }
    await insertOrRestoreRosteredPlayer({
      leagueSeasonId: season.id,
      teamId: claim.teamId,
      playerId: claim.playerId,
      slotPositionId,
      seasonRows,
      now: Date.now(),
      client: tx,
    });
  });

  return null;
}
