import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { cache } from "react";

import {
  draftPicks,
  drafts,
  draftQueue,
  playerExternalIds,
  players,
  rosterPlayers,
  teams,
} from "@/db/schema";
import { profiles } from "@/db/schema/users";
import { db } from "@/lib/db";
import {
  buildDraftSchedule,
  getDraftRounds,
  type DraftScheduleSlot,
  type DraftTeamSlot,
} from "@/lib/leagues/draft/board";
import { resolveDraftSettings } from "@/lib/leagues/draft-settings";
import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";

export type DraftPickRow = {
  id: string;
  overall: number;
  round: number;
  pickInRound: number;
  teamId: string;
  playerId: string;
  source: "manual" | "commissioner" | "autopick";
  madeAt: Date;
  playerFullName: string;
  playerPositionId: string;
  playerNflTeam: string | null;
  playerByeWeek: number | null;
  playerSleeperId: string | null;
};

export type DraftQueueRow = {
  id: string;
  playerId: string;
  sortOrder: number;
  fullName: string;
  primaryPositionId: string;
  nflTeam: string | null;
};

export type DraftRoomData = {
  draft: {
    id: string;
    status: "scheduled" | "live" | "paused" | "complete";
    currentPickIndex: number;
    startedAt: Date | null;
    pausedAt: Date | null;
    turnExpiresAt: Date | null;
    pausedSecondsRemaining: number | null;
    completedAt: Date | null;
  } | null;
  teams: Array<
    DraftTeamSlot & {
      userId: string | null;
      autoPickEnabled: boolean;
    }
  >;
  schedule: DraftScheduleSlot[];
  picks: DraftPickRow[];
  draftedPlayerIds: Set<string>;
  rounds: number;
  style: "snake" | "linear";
  onTheClock: DraftScheduleSlot | null;
};

export const getDraftBySeasonId = cache(async (leagueSeasonId: string) => {
  const [draft] = await db
    .select()
    .from(drafts)
    .where(eq(drafts.leagueSeasonId, leagueSeasonId))
    .limit(1);
  return draft ?? null;
});

export async function getSeasonDraftTeams(leagueSeasonId: string) {
  return db
    .select({
      id: teams.id,
      name: teams.name,
      logoUrl: teams.logoUrl,
      draftSlot: teams.draftSlot,
      userId: teams.userId,
      autoPickEnabled: teams.autoPickEnabled,
    })
    .from(teams)
    .where(eq(teams.leagueSeasonId, leagueSeasonId))
    .orderBy(asc(teams.draftSlot), asc(teams.createdAt));
}

export async function getDraftPicks(draftId: string): Promise<DraftPickRow[]> {
  const rows = await db
    .select({
      id: draftPicks.id,
      overall: draftPicks.overall,
      round: draftPicks.round,
      pickInRound: draftPicks.pickInRound,
      teamId: draftPicks.teamId,
      playerId: draftPicks.playerId,
      source: draftPicks.source,
      madeAt: draftPicks.madeAt,
      playerFullName: players.fullName,
      playerPositionId: players.primaryPositionId,
      playerNflTeam: players.nflTeam,
      playerByeWeek: players.byeWeek,
      playerSleeperId: playerExternalIds.externalId,
    })
    .from(draftPicks)
    .innerJoin(players, eq(draftPicks.playerId, players.id))
    .leftJoin(
      playerExternalIds,
      and(
        eq(playerExternalIds.playerId, players.id),
        eq(playerExternalIds.provider, "sleeper"),
      ),
    )
    .where(eq(draftPicks.draftId, draftId))
    .orderBy(asc(draftPicks.overall));

  return rows;
}

export type DraftPickEvent = {
  overall: number;
  playerFullName: string;
  teamName: string;
  teamId: string;
  madeByUserId: string | null;
};

/** Picks after a known overall (1-based). Used for live toast / soft refresh. */
export async function getDraftPickEventsAfter(
  draftId: string,
  afterOverall: number,
): Promise<DraftPickEvent[]> {
  return db
    .select({
      overall: draftPicks.overall,
      playerFullName: players.fullName,
      teamName: teams.name,
      teamId: draftPicks.teamId,
      madeByUserId: draftPicks.madeByUserId,
    })
    .from(draftPicks)
    .innerJoin(players, eq(draftPicks.playerId, players.id))
    .innerJoin(teams, eq(draftPicks.teamId, teams.id))
    .where(
      and(
        eq(draftPicks.draftId, draftId),
        gt(draftPicks.overall, afterOverall),
      ),
    )
    .orderBy(asc(draftPicks.overall));
}

export async function getTeamDraftQueue(teamId: string): Promise<DraftQueueRow[]> {
  return db
    .select({
      id: draftQueue.id,
      playerId: draftQueue.playerId,
      sortOrder: draftQueue.sortOrder,
      fullName: players.fullName,
      primaryPositionId: players.primaryPositionId,
      nflTeam: players.nflTeam,
    })
    .from(draftQueue)
    .innerJoin(players, eq(draftQueue.playerId, players.id))
    .where(eq(draftQueue.teamId, teamId))
    .orderBy(asc(draftQueue.sortOrder));
}

export async function getTeamDraftQueuePlayerIds(teamId: string) {
  const rows = await db
    .select({ playerId: draftQueue.playerId })
    .from(draftQueue)
    .where(eq(draftQueue.teamId, teamId));
  return rows.map((row) => row.playerId);
}

export async function getDraftRoomData(input: {
  leagueSeasonId: string;
  settings: LeagueSeasonSettings;
  benchSlots: number;
}): Promise<DraftRoomData> {
  const [draft, seasonTeams] = await Promise.all([
    getDraftBySeasonId(input.leagueSeasonId),
    getSeasonDraftTeams(input.leagueSeasonId),
  ]);

  const draftSettings = resolveDraftSettings(input.settings.draft);
  const teamsWithSlots = seasonTeams
    .filter((team) => team.draftSlot != null)
    .map((team) => ({
      id: team.id,
      name: team.name,
      logoUrl: team.logoUrl,
      draftSlot: team.draftSlot as number,
      userId: team.userId,
      autoPickEnabled: team.autoPickEnabled,
    }));

  const rounds = getDraftRounds(input.settings.rosterSlots, input.benchSlots);
  const schedule = buildDraftSchedule({
    teams: teamsWithSlots,
    rounds,
    style: draftSettings.style,
  });

  const picks = draft ? await getDraftPicks(draft.id) : [];
  const draftedPlayerIds = new Set(picks.map((pick) => pick.playerId));
  const onTheClock =
    draft &&
    (draft.status === "live" || draft.status === "paused") &&
    draft.currentPickIndex < schedule.length
      ? (schedule[draft.currentPickIndex] ?? null)
      : null;

  return {
    draft: draft
      ? {
          id: draft.id,
          status: draft.status,
          currentPickIndex: draft.currentPickIndex,
          startedAt: draft.startedAt,
          pausedAt: draft.pausedAt,
          turnExpiresAt: draft.turnExpiresAt,
          pausedSecondsRemaining: draft.pausedSecondsRemaining,
          completedAt: draft.completedAt,
        }
      : null,
    teams: teamsWithSlots,
    schedule,
    picks,
    draftedPlayerIds,
    rounds,
    style: draftSettings.style,
    onTheClock,
  };
}

export async function getTeamOwnersByIds(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, string | null>();
  const rows = await db
    .select({ id: profiles.id, displayName: profiles.displayName })
    .from(profiles)
    .where(inArray(profiles.id, userIds));
  return new Map(rows.map((row) => [row.id, row.displayName]));
}

export async function getDraftedRosterForTeam(teamId: string) {
  return db
    .select({
      playerId: players.id,
      fullName: players.fullName,
      primaryPositionId: players.primaryPositionId,
      nflTeam: players.nflTeam,
      slotPositionId: rosterPlayers.slotPositionId,
      overall: draftPicks.overall,
    })
    .from(draftPicks)
    .innerJoin(players, eq(draftPicks.playerId, players.id))
    .leftJoin(
      rosterPlayers,
      and(
        eq(rosterPlayers.teamId, teamId),
        eq(rosterPlayers.playerId, draftPicks.playerId),
      ),
    )
    .where(eq(draftPicks.teamId, teamId))
    .orderBy(asc(draftPicks.overall));
}
