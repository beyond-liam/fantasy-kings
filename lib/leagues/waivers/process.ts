import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import {
  leagueActivity,
  leagueSeasons,
  players,
  teams,
  waiverClaims,
} from "@/db/schema";
import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import { resolveIrEligibleStatuses } from "@/lib/leagues/ir-eligibility";
import {
  countActivePositionPlayers,
  countActiveRosterPlayers,
  getMaxRosterSize,
  getPositionRosterMax,
} from "@/lib/leagues/roster-capacity";
import { pickDefaultSlotPosition, occupiedBySlot } from "@/lib/leagues/roster-slots";
import {
  assertIrAcquisitionsAllowed,
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
import {
  createNotifications,
  transactionsHref,
  type CreateNotificationInput,
} from "@/lib/notifications/create";

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

  const processInstant =
    getLastProcessInstantUtc(wire.processDays, now) ?? now;
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
    leagueSeasonId: season.id,
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
