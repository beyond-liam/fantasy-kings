"use server";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  draftPicks,
  drafts,
  draftQueue,
  leagueSeasons,
  players,
  rosterPlayers,
  teams,
} from "@/db/schema";
import { requireSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  buildDraftSchedule,
  getDraftRounds,
} from "@/lib/leagues/draft/board";
import { activateDraftLive } from "@/lib/leagues/draft/activate";
import {
  computeTurnExpiresAt,
  secondsUntil,
} from "@/lib/leagues/draft/clock";
import { resolveDraftSettings } from "@/lib/leagues/draft-settings";
import {
  countActivePositionPlayers,
  countActiveRosterPlayers,
  getMaxRosterSize,
  getPositionRosterMax,
} from "@/lib/leagues/roster-capacity";
import { pickDefaultSlotPosition } from "@/lib/leagues/roster-slots";
import { resolveIrEligibleStatuses } from "@/lib/leagues/ir-eligibility";
import {
  getLeagueBySlug,
  isLeagueCommissioner,
} from "@/lib/queries/leagues";
import { getDraftBySeasonId, getSeasonDraftTeams } from "@/lib/queries/draft";

type ActionResult = {
  success: boolean;
  error?: string;
  /** Present on tryAutoStartDraft when the draft was (or already is) live. */
  started?: boolean;
};

type MakeDraftPickResult = ActionResult & {
  overall?: number;
  playerFullName?: string;
  teamName?: string;
};

function revalidateDraftPaths(slug: string) {
  revalidatePath(`/league/${slug}/draft`);
  revalidatePath(`/league/${slug}/players`);
  revalidatePath(`/league/${slug}/team`);
  revalidatePath(`/league/${slug}`);
}

async function getDraftActionContext(slug: string) {
  const user = await requireSessionUser();
  const league = await getLeagueBySlug(slug);
  if (!league) {
    return { error: "League not found." as const };
  }

  const [season] = await db
    .select()
    .from(leagueSeasons)
    .where(eq(leagueSeasons.leagueId, league.id))
    .limit(1);

  if (!season) {
    return { error: "League season not found." as const };
  }

  const isCommissioner = await isLeagueCommissioner(league.id, user.id);
  const seasonTeams = await getSeasonDraftTeams(season.id);
  const userTeam = seasonTeams.find((team) => team.userId === user.id) ?? null;

  return { user, league, season, isCommissioner, seasonTeams, userTeam };
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

export async function startDraft(slug: string): Promise<ActionResult> {
  const context = await getDraftActionContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { season, league, isCommissioner, seasonTeams } = context;
  if (!isCommissioner) {
    return { success: false, error: "Only the commissioner can start the draft." };
  }

  const activated = await activateDraftLive({
    seasonId: season.id,
    seasonStatus: season.status,
    seasonTeams,
    pickTimeLimitSeconds: season.pickTimeLimitSeconds,
    allowResume: true,
  });

  if (!activated.ok) {
    return { success: false, error: activated.error };
  }

  if (!activated.resumed) {
    const { announceDraftStarted } = await import("@/lib/alerts/draft");
    await announceDraftStarted({
      seasonId: season.id,
      leaguePublicId: league.publicId,
      leagueName: league.name,
      resumed: false,
    });
  }

  revalidateDraftPaths(league.publicId);
  return { success: true };
}

/**
 * Any league member can trigger start once `draftStartAt` has passed.
 * Idempotent if already live. Does not resume a paused draft.
 */
export async function tryAutoStartDraft(slug: string): Promise<ActionResult> {
  const context = await getDraftActionContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { season, league, seasonTeams } = context;
  const now = new Date();
  if (season.draftStartAt.getTime() > now.getTime()) {
    return {
      success: false,
      error: "Draft start time has not been reached yet.",
    };
  }

  const existing = await getDraftBySeasonId(season.id);
  if (existing?.status === "live") {
    return { success: true, started: true };
  }
  if (existing?.status === "paused") {
    return {
      success: false,
      error: "Draft is paused. The commissioner can resume it.",
    };
  }
  if (existing?.status === "complete") {
    return { success: false, error: "Draft is already complete." };
  }

  const activated = await activateDraftLive({
    seasonId: season.id,
    seasonStatus: season.status,
    seasonTeams,
    pickTimeLimitSeconds: season.pickTimeLimitSeconds,
    allowResume: false,
  });

  if (!activated.ok) {
    return { success: false, error: activated.error };
  }

  const { announceDraftStarted } = await import("@/lib/alerts/draft");
  await announceDraftStarted({
    seasonId: season.id,
    leaguePublicId: league.publicId,
    leagueName: league.name,
    resumed: false,
  });

  revalidateDraftPaths(league.publicId);
  return { success: true, started: true };
}

export async function pauseDraft(slug: string): Promise<ActionResult> {
  const context = await getDraftActionContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { season, league, isCommissioner } = context;
  if (!isCommissioner) {
    return { success: false, error: "Only the commissioner can pause the draft." };
  }

  const draft = await getDraftBySeasonId(season.id);
  if (!draft || draft.status !== "live") {
    return { success: false, error: "Draft is not live." };
  }

  const now = new Date();
  let pausedSecondsRemaining: number | null = null;
  if (season.pickTimeLimitSeconds > 0) {
    if (draft.turnExpiresAt) {
      pausedSecondsRemaining = secondsUntil(draft.turnExpiresAt, now);
    } else {
      pausedSecondsRemaining = season.pickTimeLimitSeconds;
    }
  }

  await db
    .update(drafts)
    .set({
      status: "paused",
      pausedAt: now,
      turnExpiresAt: null,
      pausedSecondsRemaining,
    })
    .where(eq(drafts.id, draft.id));

  revalidateDraftPaths(league.publicId);
  return { success: true };
}

export async function makeDraftPick(
  slug: string,
  playerId: string,
  options?: {
    asCommissioner?: boolean;
    autopick?: boolean;
    /** When set, no-op success if the draft has already moved past this index. */
    expectPickIndex?: number;
  },
): Promise<MakeDraftPickResult> {
  const context = await getDraftActionContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const {
    user,
    league,
    season,
    isCommissioner,
    seasonTeams,
    userTeam,
  } = context;

  const asCommissioner = Boolean(options?.asCommissioner);
  const isAutopick = Boolean(options?.autopick);
  if (asCommissioner && !isCommissioner) {
    return {
      success: false,
      error: "Only the commissioner can make a commissioner pick.",
    };
  }

  if (isAutopick && !userTeam && !isCommissioner) {
    return {
      success: false,
      error: "Only league members can trigger autopick.",
    };
  }

  const draft = await getDraftBySeasonId(season.id);
  if (!draft || draft.status !== "live") {
    return {
      success: false,
      error:
        draft?.status === "paused"
          ? "Draft is paused."
          : "Draft is not live.",
    };
  }

  if (
    options?.expectPickIndex != null &&
    draft.currentPickIndex !== options.expectPickIndex
  ) {
    return { success: true };
  }

  const draftSettings = resolveDraftSettings(season.settings.draft);
  const teamsWithSlots = seasonTeams
    .filter((team) => team.draftSlot != null)
    .map((team) => ({
      id: team.id,
      name: team.name,
      draftSlot: team.draftSlot as number,
    }));

  const rounds = getDraftRounds(season.settings.rosterSlots, season.benchSlots);
  const schedule = buildDraftSchedule({
    teams: teamsWithSlots,
    rounds,
    style: draftSettings.style,
  });

  const slot = schedule[draft.currentPickIndex];
  if (!slot) {
    return { success: false, error: "Draft is already complete." };
  }

  if (!asCommissioner && !isAutopick) {
    if (!userTeam || userTeam.id !== slot.teamId) {
      return { success: false, error: "It is not your turn to pick." };
    }
  }

  const [player] = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      primaryPositionId: players.primaryPositionId,
      injuryStatus: players.injuryStatus,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (!player) {
    return { success: false, error: "Player not found." };
  }

  const existingPick = await db
    .select({ id: draftPicks.id })
    .from(draftPicks)
    .where(
      and(eq(draftPicks.draftId, draft.id), eq(draftPicks.playerId, playerId)),
    )
    .limit(1);

  if (existingPick.length > 0) {
    return { success: false, error: "Player has already been drafted." };
  }

  // Ownership may exist from pre-draft free agency / cuts (waived rows still block inserts).
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
        eq(teams.leagueSeasonId, season.id),
        eq(rosterPlayers.playerId, playerId),
      ),
    );

  const rosteredElsewhere = seasonRosterRows.find(
    (row) => row.status === "rostered",
  );
  if (rosteredElsewhere) {
    return {
      success: false,
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
    season.settings.rosterSlots,
    season.benchSlots,
  );
  if (countActiveRosterPlayers(rosteredOnTeam) >= maxRoster) {
    return { success: false, error: "This team's roster is full." };
  }

  const positionMax = getPositionRosterMax(
    season.settings.rosterSlots,
    player.primaryPositionId,
  );
  if (
    positionMax !== Number.POSITIVE_INFINITY &&
    countActivePositionPlayers(rosteredOnTeam, player.primaryPositionId) >=
      positionMax
  ) {
    return {
      success: false,
      error: `At max ${player.primaryPositionId}s for this team.`,
    };
  }

  const slotPositionId = pickDefaultSlotPosition({
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
  });

  const nextIndex = draft.currentPickIndex + 1;
  const isComplete = nextIndex >= schedule.length;
  const source = isAutopick
    ? "autopick"
    : asCommissioner
      ? "commissioner"
      : "manual";
  const acquiredAt = new Date();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(draftPicks).values({
        draftId: draft.id,
        overall: slot.overall,
        round: slot.round,
        pickInRound: slot.pickInRound,
        teamId: slot.teamId,
        playerId,
        source,
        madeByUserId: user.id,
      });

      if (waivedOnTeam) {
        await tx
          .update(rosterPlayers)
          .set({
            status: "rostered",
            waiverClearsAt: null,
            slotPositionId,
            acquiredAt,
            updatedAt: new Date(),
          })
          .where(eq(rosterPlayers.id, waivedOnTeam.id));
      } else {
        await tx.insert(rosterPlayers).values({
          teamId: slot.teamId,
          playerId,
          status: "rostered",
          slotPositionId,
          acquiredAt,
        });
      }

      // Clear drafted player from all queues in this season.
      const seasonTeamIds = seasonTeams.map((team) => team.id);
      if (seasonTeamIds.length > 0) {
        await tx
          .delete(draftQueue)
          .where(
            and(
              eq(draftQueue.playerId, playerId),
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
            : computeTurnExpiresAt(acquiredAt, season.pickTimeLimitSeconds),
          pausedSecondsRemaining: null,
          pausedAt: null,
        })
        .where(eq(drafts.id, draft.id));

      if (isComplete) {
        await tx
          .update(leagueSeasons)
          .set({ status: "active" })
          .where(eq(leagueSeasons.id, season.id));
      }
    });
  } catch (error) {
    console.error("makeDraftPick failed", error);
    return {
      success: false,
      error: "Could not save this pick. Refresh and try again.",
    };
  }

  const { announceDraftAfterPick } = await import("@/lib/alerts/draft");
  await announceDraftAfterPick({
    seasonId: season.id,
    leaguePublicId: league.publicId,
    leagueName: league.name,
    draftId: draft.id,
    nextPickIndex: nextIndex,
    scheduleLength: schedule.length,
    seasonTeams,
  });

  revalidateDraftPaths(league.publicId);
  return {
    success: true,
    overall: slot.overall,
    playerFullName: player.fullName,
    teamName: slot.teamName,
  };
}

/**
 * Clock expiry / autopick: queue-first, then best remaining projection rank.
 * Idempotent if the pick already advanced.
 */
export async function autoDraftCurrentPick(
  slug: string,
): Promise<MakeDraftPickResult> {
  const context = await getDraftActionContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { season, isCommissioner, seasonTeams, userTeam } = context;
  if (!userTeam && !isCommissioner) {
    return {
      success: false,
      error: "Only league members can trigger autopick.",
    };
  }

  const draft = await getDraftBySeasonId(season.id);
  if (!draft || draft.status !== "live") {
    return {
      success: false,
      error:
        draft?.status === "paused"
          ? "Draft is paused."
          : "Draft is not live.",
    };
  }

  const draftSettings = resolveDraftSettings(season.settings.draft);
  const teamsWithSlots = seasonTeams
    .filter((team) => team.draftSlot != null)
    .map((team) => ({
      id: team.id,
      name: team.name,
      draftSlot: team.draftSlot as number,
      autoPickEnabled: team.autoPickEnabled,
    }));

  const rounds = getDraftRounds(season.settings.rosterSlots, season.benchSlots);
  const schedule = buildDraftSchedule({
    teams: teamsWithSlots,
    rounds,
    style: draftSettings.style,
  });

  const slot = schedule[draft.currentPickIndex];
  if (!slot) {
    return { success: true };
  }

  const onClockTeam = teamsWithSlots.find((team) => team.id === slot.teamId);
  const autopickAllowed =
    draftSettings.autoPickEnabled || Boolean(onClockTeam?.autoPickEnabled);
  if (!autopickAllowed) {
    return { success: false, error: "Autopick is not enabled for this pick." };
  }

  const existingPicks = await db
    .select({ playerId: draftPicks.playerId })
    .from(draftPicks)
    .where(eq(draftPicks.draftId, draft.id));
  const drafted = new Set(existingPicks.map((row) => row.playerId));

  const queueRows = await db
    .select({ playerId: draftQueue.playerId })
    .from(draftQueue)
    .where(eq(draftQueue.teamId, slot.teamId))
    .orderBy(asc(draftQueue.sortOrder));

  let playerId =
    queueRows.find((row) => !drafted.has(row.playerId))?.playerId ?? null;

  if (!playerId) {
    const { resolveScoringRuleDefinitions } = await import(
      "@/lib/leagues/scoring"
    );
    const { getRankedPlayers } = await import("@/lib/queries/players");
    const { getNflState } = await import("@/lib/sleeper/api");
    const nflState = await getNflState();
    const scoringRules = resolveScoringRuleDefinitions(
      season.scoringPreset as "full_ppr" | "half_ppr" | "standard",
      season.settings.scoringRules,
    );
    const ranked = await getRankedPlayers({
      season: nflState.season,
      week: 0,
      kind: "projection",
      scoringRules,
    }).catch(() => []);
    playerId =
      ranked.find((player) => !drafted.has(player.id))?.id ?? null;
  }

  if (!playerId) {
    return { success: false, error: "No players left to autopick." };
  }

  return makeDraftPick(slug, playerId, {
    autopick: true,
    expectPickIndex: draft.currentPickIndex,
  });
}

export async function revertLastDraftPick(slug: string): Promise<ActionResult> {
  const context = await getDraftActionContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { league, season, isCommissioner } = context;
  if (!isCommissioner) {
    return {
      success: false,
      error: "Only the commissioner can revert a pick.",
    };
  }

  const draft = await getDraftBySeasonId(season.id);
  if (!draft) {
    return { success: false, error: "Draft has not started." };
  }

  if (
    draft.status !== "live" &&
    draft.status !== "paused" &&
    draft.status !== "complete"
  ) {
    return { success: false, error: "Nothing to revert." };
  }

  if (draft.currentPickIndex <= 0) {
    return { success: false, error: "No picks to revert." };
  }

  const [lastPick] = await db
    .select({
      id: draftPicks.id,
      teamId: draftPicks.teamId,
      playerId: draftPicks.playerId,
      overall: draftPicks.overall,
    })
    .from(draftPicks)
    .where(eq(draftPicks.draftId, draft.id))
    .orderBy(desc(draftPicks.overall))
    .limit(1);

  if (!lastPick) {
    return { success: false, error: "No picks to revert." };
  }

  const nextIndex = Math.max(0, draft.currentPickIndex - 1);
  const wasComplete = draft.status === "complete";

  try {
    await db.transaction(async (tx) => {
      await tx.delete(draftPicks).where(eq(draftPicks.id, lastPick.id));

      // Remove draft acquisition from roster (row may have been restored from waived).
      await tx
        .delete(rosterPlayers)
        .where(
          and(
            eq(rosterPlayers.teamId, lastPick.teamId),
            eq(rosterPlayers.playerId, lastPick.playerId),
            eq(rosterPlayers.status, "rostered"),
          ),
        );

      await tx
        .update(drafts)
        .set({
          currentPickIndex: nextIndex,
          status: wasComplete ? "live" : draft.status,
          completedAt: null,
        })
        .where(eq(drafts.id, draft.id));

      if (wasComplete || season.status === "active") {
        await tx
          .update(leagueSeasons)
          .set({ status: "draft" })
          .where(eq(leagueSeasons.id, season.id));
      }
    });
  } catch (error) {
    console.error("revertLastDraftPick failed", error);
    return {
      success: false,
      error: "Could not revert this pick. Refresh and try again.",
    };
  }

  revalidateDraftPaths(league.publicId);
  return { success: true };
}

export async function toggleDraftQueue(
  slug: string,
  playerId: string,
): Promise<ActionResult & { queued?: boolean }> {
  const context = await getDraftActionContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { league, season, userTeam } = context;
  if (!userTeam) {
    return { success: false, error: "You don't have a team in this league." };
  }

  const draft = await getDraftBySeasonId(season.id);
  if (draft?.status === "complete") {
    return { success: false, error: "Draft is complete." };
  }

  const [existing] = await db
    .select({ id: draftQueue.id })
    .from(draftQueue)
    .where(
      and(
        eq(draftQueue.teamId, userTeam.id),
        eq(draftQueue.playerId, playerId),
      ),
    )
    .limit(1);

  if (existing) {
    await db.delete(draftQueue).where(eq(draftQueue.id, existing.id));
    revalidateDraftPaths(league.publicId);
    return { success: true, queued: false };
  }

  const [{ value: maxOrder } = { value: 0 }] = await db
    .select({ value: sql<number>`coalesce(max(${draftQueue.sortOrder}), 0)` })
    .from(draftQueue)
    .where(eq(draftQueue.teamId, userTeam.id));

  await db.insert(draftQueue).values({
    teamId: userTeam.id,
    playerId,
    sortOrder: Number(maxOrder) + 1,
  });

  revalidateDraftPaths(league.publicId);
  return { success: true, queued: true };
}

export async function reorderDraftQueue(
  slug: string,
  playerIds: string[],
): Promise<ActionResult> {
  const context = await getDraftActionContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { league, userTeam } = context;
  if (!userTeam) {
    return { success: false, error: "You don't have a team in this league." };
  }

  const existing = await db
    .select({ playerId: draftQueue.playerId })
    .from(draftQueue)
    .where(eq(draftQueue.teamId, userTeam.id));

  const existingIds = new Set(existing.map((row) => row.playerId));
  if (
    playerIds.length !== existingIds.size ||
    playerIds.some((id) => !existingIds.has(id))
  ) {
    return { success: false, error: "Queue is out of date. Refresh and try again." };
  }

  for (let index = 0; index < playerIds.length; index++) {
    await db
      .update(draftQueue)
      .set({ sortOrder: index + 1 })
      .where(
        and(
          eq(draftQueue.teamId, userTeam.id),
          eq(draftQueue.playerId, playerIds[index]!),
        ),
      );
  }

  revalidateDraftPaths(league.publicId);
  return { success: true };
}

export async function removeFromDraftQueue(
  slug: string,
  playerId: string,
): Promise<ActionResult> {
  const context = await getDraftActionContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { league, userTeam } = context;
  if (!userTeam) {
    return { success: false, error: "You don't have a team in this league." };
  }

  await db
    .delete(draftQueue)
    .where(
      and(
        eq(draftQueue.teamId, userTeam.id),
        eq(draftQueue.playerId, playerId),
      ),
    );

  revalidateDraftPaths(league.publicId);
  return { success: true };
}
