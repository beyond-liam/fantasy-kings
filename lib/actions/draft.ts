"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  draftPicks,
  drafts,
  draftQueue,
  leagueActivity,
  leagueSeasons,
  players,
  rosterPlayers,
  teams,
} from "@/db/schema";
import { db } from "@/lib/db";
import { activateDraftLive } from "@/lib/leagues/draft/activate";
import { secondsUntil } from "@/lib/leagues/draft/clock";
import { commitDraftPick } from "@/lib/leagues/draft/pick";
import { loadDraftActionContext } from "@/lib/leagues/action-context";
import { getDraftBySeasonId } from "@/lib/queries/draft";

const draftPickSchema = z.string().uuid();

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
  /** When false, draft-room client should not keep retrying this pick. */
  retry?: boolean;
};

function revalidateDraftPaths(slug: string) {
  revalidatePath(`/league/${slug}/draft`);
  revalidatePath(`/league/${slug}/players`);
  revalidatePath(`/league/${slug}/team`);
  revalidatePath(`/league/${slug}/activity`);
  revalidatePath(`/league/${slug}`);
}

async function getDraftActionContext(slug: string) {
  return loadDraftActionContext(slug);
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

  const { drainDraftAutopick } = await import(
    "@/lib/leagues/draft/process-expired-picks"
  );
  await drainDraftAutopick({
    leagueSeasonId: season.id,
    leaguePublicId: league.publicId,
    leagueName: league.name,
  });

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

  const { drainDraftAutopick } = await import(
    "@/lib/leagues/draft/process-expired-picks"
  );
  await drainDraftAutopick({
    leagueSeasonId: season.id,
    leaguePublicId: league.publicId,
    leagueName: league.name,
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
      pausedByWindow: false,
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
  const parsed = draftPickSchema.safeParse(playerId);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid player ID.",
    };
  }

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

  const source = isAutopick
    ? "autopick"
    : asCommissioner
      ? "commissioner"
      : "manual";

  const committed = await commitDraftPick({
    leagueSeasonId: season.id,
    draftId: draft.id,
    currentPickIndex: draft.currentPickIndex,
    pickTimeLimitSeconds: season.pickTimeLimitSeconds,
    settings: season.settings,
    benchSlots: season.benchSlots,
    irEnabled: season.irEnabled,
    taxiEnabled: season.taxiEnabled,
    seasonTeams,
    playerId: parsed.data,
    madeByUserId: user.id,
    source,
    actingTeamId: source === "manual" ? userTeam?.id ?? null : null,
  });

  if (!committed.ok) {
    return { success: false, error: committed.error };
  }

  if (committed.isComplete) {
    try {
      const { computeAndPersistDraftGrades } = await import(
        "@/lib/leagues/draft/persist-grades"
      );
      await computeAndPersistDraftGrades({
        draftId: draft.id,
        leagueSeasonId: season.id,
        settings: season.settings,
        scoringPreset: season.scoringPreset,
        regularSeasonEndWeek: season.regularSeasonEndWeek,
        playoffTeamCount: season.playoffTeamCount,
        teamIds: seasonTeams.map((team) => team.id),
      });
    } catch (error) {
      console.error("computeAndPersistDraftGrades failed", error);
    }
  }

  const { announceDraftAfterPick } = await import("@/lib/alerts/draft");
  await announceDraftAfterPick({
    seasonId: season.id,
    leaguePublicId: league.publicId,
    leagueName: league.name,
    draftId: draft.id,
    nextPickIndex: committed.nextPickIndex,
    scheduleLength: committed.scheduleLength,
    seasonTeams,
  });

  if (!committed.isComplete) {
    const { drainDraftAutopick } = await import(
      "@/lib/leagues/draft/process-expired-picks"
    );
    await drainDraftAutopick({
      leagueSeasonId: season.id,
      leaguePublicId: league.publicId,
      leagueName: league.name,
      madeByUserId: user.id,
    });
  }

  revalidateDraftPaths(league.publicId);
  return {
    success: true,
    overall: committed.overall,
    playerFullName: committed.playerFullName,
    teamName: committed.teamName,
  };
}

/**
 * Autopick for the current seat when eligible.
 * Claimed + autopick on: queue pick as soon as the team is on the clock.
 * Open seats: queue → BPA after clock expiry (or untimed).
 */
export async function autoDraftCurrentPick(
  slug: string,
): Promise<MakeDraftPickResult> {
  const context = await getDraftActionContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { season, league, isCommissioner, userTeam, user } = context;
  if (!userTeam && !isCommissioner) {
    return {
      success: false,
      error: "Only league members can trigger autopick.",
    };
  }

  const { runDraftAutopick } = await import(
    "@/lib/leagues/draft/process-expired-picks"
  );
  const outcome = await runDraftAutopick({
    leagueSeasonId: season.id,
    leaguePublicId: league.publicId,
    leagueName: league.name,
    enforceExpiry: true,
    madeByUserId: user.id,
  });

  if (!outcome.ok) {
    const retry =
      outcome.reason !== "disabled" &&
      outcome.reason !== "no_queue" &&
      outcome.reason !== "not_due";
    return { success: false, error: outcome.error, retry };
  }

  return {
    success: true,
    overall: outcome.overall || undefined,
    playerFullName: outcome.playerFullName || undefined,
    teamName: outcome.teamName || undefined,
  };
}

export async function revertLastDraftPick(slug: string): Promise<ActionResult> {
  const context = await getDraftActionContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { league, season, isCommissioner, user } = context;
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
      round: draftPicks.round,
      pickInRound: draftPicks.pickInRound,
      source: draftPicks.source,
      teamName: teams.name,
      playerFullName: players.fullName,
    })
    .from(draftPicks)
    .innerJoin(teams, eq(draftPicks.teamId, teams.id))
    .innerJoin(players, eq(draftPicks.playerId, players.id))
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

      await tx.insert(leagueActivity).values({
        leagueSeasonId: season.id,
        type: "draft_pick_reverted",
        teamId: lastPick.teamId,
        actorUserId: user.id,
        playerId: lastPick.playerId,
        summary: `${lastPick.teamName} pick of ${lastPick.playerFullName} reverted · Pick #${lastPick.overall}`,
        metadata: {
          playerName: lastPick.playerFullName,
          teamName: lastPick.teamName,
          overall: lastPick.overall,
          round: lastPick.round,
          pickInRound: lastPick.pickInRound,
          draftSource: lastPick.source,
        },
      });
    });
  } catch (error) {
    console.error("revertLastDraftPick failed", error);
    return {
      success: false,
      error: "Could not revert this pick. Refresh and try again.",
    };
  }

  if (wasComplete) {
    try {
      const { deleteDraftGradesForDraft } = await import(
        "@/lib/leagues/draft/persist-grades"
      );
      await deleteDraftGradesForDraft(draft.id);
    } catch (error) {
      console.error("deleteDraftGradesForDraft failed", error);
    }
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

  if (userTeam.autoPickEnabled) {
    const { drainDraftAutopick } = await import(
      "@/lib/leagues/draft/process-expired-picks"
    );
    await drainDraftAutopick({
      leagueSeasonId: season.id,
      leaguePublicId: league.publicId,
      leagueName: league.name,
    });
  }

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
