import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import {
  draftPicks,
  drafts,
  draftQueue,
  leagueSeasons,
  players,
  rosterPlayers,
  teams,
} from "@/db/schema";
import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import {
  buildDraftSchedule,
  getDraftRounds,
  type DraftScheduleSlot,
} from "@/lib/leagues/draft/board";
import { computeTurnExpiresAt } from "@/lib/leagues/draft/clock";
import { resolveDraftSettings } from "@/lib/leagues/draft-settings";
import { resolveIrEligibleStatuses } from "@/lib/leagues/ir-eligibility";
import {
  countActivePositionPlayers,
  countActiveRosterPlayers,
  getMaxRosterSize,
  getPositionRosterMax,
} from "@/lib/leagues/roster-capacity";
import { pickDefaultSlotPosition, occupiedBySlot } from "@/lib/leagues/roster-slots";

export type DraftPickSource = "manual" | "commissioner" | "autopick";

export type SeasonDraftTeam = {
  id: string;
  name: string;
  draftSlot: number | null;
  userId: string | null;
};

export type CommitDraftPickInput = {
  leagueSeasonId: string;
  draftId: string;
  currentPickIndex: number;
  pickTimeLimitSeconds: number;
  settings: LeagueSeasonSettings;
  benchSlots: number;
  irEnabled: boolean;
  taxiEnabled: boolean;
  seasonTeams: SeasonDraftTeam[];
  playerId: string;
  madeByUserId: string;
  source: DraftPickSource;
  /**
   * When set, enforce that this team is on the clock.
   * Omit for commissioner / autopick sources.
   */
  actingTeamId?: string | null;
};

export type CommitDraftPickResult =
  | {
      ok: true;
      alreadyAdvanced?: true;
      overall: number;
      playerFullName: string;
      teamName: string;
      teamId: string;
      nextPickIndex: number;
      scheduleLength: number;
      schedule: DraftScheduleSlot[];
      isComplete: boolean;
    }
  | { ok: false; error: string };

/**
 * Validate and commit one Pick: roster write, board advance, optional season → active.
 * Caller owns auth (commissioner / membership) and League Alert / revalidate.
 */
export async function commitDraftPick(
  input: CommitDraftPickInput,
): Promise<CommitDraftPickResult> {
  const draftSettings = resolveDraftSettings(input.settings.draft);
  const teamsWithSlots = input.seasonTeams
    .filter((team) => team.draftSlot != null)
    .map((team) => ({
      id: team.id,
      name: team.name,
      draftSlot: team.draftSlot as number,
    }));

  const rounds = getDraftRounds(input.settings.rosterSlots, input.benchSlots);
  const schedule = buildDraftSchedule({
    teams: teamsWithSlots,
    rounds,
    style: draftSettings.style,
  });

  const slot = schedule[input.currentPickIndex];
  if (!slot) {
    return { ok: false, error: "Draft is already complete." };
  }

  if (
    input.source === "manual" &&
    input.actingTeamId != null &&
    input.actingTeamId !== slot.teamId
  ) {
    return { ok: false, error: "It is not your turn to pick." };
  }

  const [player] = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      primaryPositionId: players.primaryPositionId,
      injuryStatus: players.injuryStatus,
    })
    .from(players)
    .where(eq(players.id, input.playerId))
    .limit(1);

  if (!player) {
    return { ok: false, error: "Player not found." };
  }

  const existingPick = await db
    .select({ id: draftPicks.id })
    .from(draftPicks)
    .where(
      and(
        eq(draftPicks.draftId, input.draftId),
        eq(draftPicks.playerId, input.playerId),
      ),
    )
    .limit(1);

  if (existingPick.length > 0) {
    return { ok: false, error: "Player has already been drafted." };
  }

  const seasonRosterRows = await db
    .select({
      id: rosterPlayers.id,
      teamId: rosterPlayers.teamId,
      status: rosterPlayers.status,
    })
    .from(rosterPlayers)
    .innerJoin(teams, eq(rosterPlayers.teamId, teams.id))
    .where(
      and(
        eq(teams.leagueSeasonId, input.leagueSeasonId),
        eq(rosterPlayers.playerId, input.playerId),
      ),
    );

  const rosteredElsewhere = seasonRosterRows.find(
    (row) => row.status === "rostered",
  );
  if (rosteredElsewhere) {
    return {
      ok: false,
      error:
        rosteredElsewhere.teamId === slot.teamId
          ? "Player is already on this roster."
          : "Player is already on another team.",
    };
  }

  const waivedOnTeam = seasonRosterRows.find(
    (row) => row.teamId === slot.teamId && row.status === "waived",
  );

  const rosteredOnTeam = await db
    .select({
      slotPositionId: rosterPlayers.slotPositionId,
      primaryPositionId: players.primaryPositionId,
    })
    .from(rosterPlayers)
    .innerJoin(players, eq(rosterPlayers.playerId, players.id))
    .where(
      and(
        eq(rosterPlayers.teamId, slot.teamId),
        eq(rosterPlayers.status, "rostered"),
      ),
    );

  const maxRoster = getMaxRosterSize(
    input.settings.rosterSlots,
    input.benchSlots,
  );
  if (countActiveRosterPlayers(rosteredOnTeam) >= maxRoster) {
    return { ok: false, error: "This team's roster is full." };
  }

  const positionMax = getPositionRosterMax(
    input.settings.rosterSlots,
    player.primaryPositionId,
  );
  if (
    positionMax !== Number.POSITIVE_INFINITY &&
    countActivePositionPlayers(rosteredOnTeam, player.primaryPositionId) >=
      positionMax
  ) {
    return {
      ok: false,
      error: `At max ${player.primaryPositionId}s for this team.`,
    };
  }

  const slotPositionId = pickDefaultSlotPosition({
    playerPositionId: player.primaryPositionId,
    injuryStatus: player.injuryStatus,
    irEligibleStatuses: resolveIrEligibleStatuses(
      input.settings.irEligibleStatuses,
    ),
    rosterSlots: input.settings.rosterSlots,
    benchSlots: input.benchSlots,
    irEnabled: input.irEnabled,
    taxiEnabled: input.taxiEnabled,
    occupiedBySlot: occupiedBySlot(rosteredOnTeam),
  });

  const nextIndex = input.currentPickIndex + 1;
  const isComplete = nextIndex >= schedule.length;
  const acquiredAt = new Date();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(draftPicks).values({
        draftId: input.draftId,
        overall: slot.overall,
        round: slot.round,
        pickInRound: slot.pickInRound,
        teamId: slot.teamId,
        playerId: input.playerId,
        source: input.source,
        madeByUserId: input.madeByUserId,
      });

      if (waivedOnTeam) {
        await tx
          .update(rosterPlayers)
          .set({
            status: "rostered",
            waiverClearsAt: null,
            slotPositionId,
            leagueSeasonId: input.leagueSeasonId,
            acquiredAt,
            updatedAt: new Date(),
          })
          .where(eq(rosterPlayers.id, waivedOnTeam.id));
      } else {
        await tx.insert(rosterPlayers).values({
          leagueSeasonId: input.leagueSeasonId,
          teamId: slot.teamId,
          playerId: input.playerId,
          status: "rostered",
          slotPositionId,
          acquiredAt,
        });
      }

      const seasonTeamIds = input.seasonTeams.map((team) => team.id);
      if (seasonTeamIds.length > 0) {
        await tx
          .delete(draftQueue)
          .where(
            and(
              eq(draftQueue.playerId, input.playerId),
              inArray(draftQueue.teamId, seasonTeamIds),
            ),
          );
      }

      await tx
        .update(drafts)
        .set({
          currentPickIndex: nextIndex,
          status: isComplete ? "complete" : "live",
          completedAt: isComplete ? new Date() : null,
          turnExpiresAt: isComplete
            ? null
            : computeTurnExpiresAt(acquiredAt, input.pickTimeLimitSeconds),
          pausedSecondsRemaining: null,
          pausedAt: null,
        })
        .where(eq(drafts.id, input.draftId));

      if (isComplete) {
        await tx
          .update(leagueSeasons)
          .set({ status: "active" })
          .where(eq(leagueSeasons.id, input.leagueSeasonId));
      }
    });
  } catch (error) {
    console.error("commitDraftPick failed", error);
    return {
      ok: false,
      error: "Could not save this pick. Refresh and try again.",
    };
  }

  return {
    ok: true,
    overall: slot.overall,
    playerFullName: player.fullName,
    teamName: slot.teamName,
    teamId: slot.teamId,
    nextPickIndex: nextIndex,
    scheduleLength: schedule.length,
    schedule,
    isComplete,
  };
}
