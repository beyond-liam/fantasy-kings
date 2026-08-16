import "server-only";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { drafts, leagueSeasons, leagues } from "@/db/schema";
import { db } from "@/lib/db";
import {
  buildDraftSchedule,
  getDraftRounds,
} from "@/lib/leagues/draft/board";
import { commitDraftPick } from "@/lib/leagues/draft/pick";
import { selectAutopickPlayerId } from "@/lib/leagues/draft/select-autopick-player";
import { resolveDraftSettings } from "@/lib/leagues/draft-settings";
import {
  applyDraftPauseWindows,
} from "@/lib/leagues/draft/pause-window";
import {
  getDraftBySeasonId,
  getSeasonDraftTeams,
} from "@/lib/queries/draft";

export type RunDraftAutopickResult =
  | {
      ok: true;
      overall: number;
      playerFullName: string;
      teamName: string;
      isComplete: boolean;
    }
  | { ok: false; error: string; reason?: "not_due" | "disabled" | "no_queue" | "other" };

/**
 * Autopick the current on-clock seat when due.
 *
 * Claimed seats with autopick on: pick from the queue immediately when the
 * team is on the clock (do not wait for expiry). Empty queue waits for a
 * manual pick.
 * Open seats: queue then BPA, still subject to expiry / untimed rules.
 */
export async function runDraftAutopick(input: {
  leagueSeasonId: string;
  leaguePublicId: string;
  leagueName: string;
  /** When true, only proceed if the clock expired (or open seat with no clock).
   *  Claimed queue autopicks ignore this and fire as soon as a queue player is available. */
  enforceExpiry: boolean;
  madeByUserId: string | null;
  /** Cron path should set sync so emails send inline. */
  syncAlerts?: boolean;
}): Promise<RunDraftAutopickResult> {
  const [season] = await db
    .select({
      id: leagueSeasons.id,
      settings: leagueSeasons.settings,
      benchSlots: leagueSeasons.benchSlots,
      irEnabled: leagueSeasons.irEnabled,
      taxiEnabled: leagueSeasons.taxiEnabled,
      pickTimeLimitSeconds: leagueSeasons.pickTimeLimitSeconds,
      scoringPreset: leagueSeasons.scoringPreset,
      regularSeasonEndWeek: leagueSeasons.regularSeasonEndWeek,
      playoffTeamCount: leagueSeasons.playoffTeamCount,
    })
    .from(leagueSeasons)
    .where(eq(leagueSeasons.id, input.leagueSeasonId))
    .limit(1);

  if (!season) {
    return { ok: false, error: "Season not found.", reason: "other" };
  }

  const draft = await getDraftBySeasonId(season.id);
  if (!draft || draft.status !== "live") {
    return {
      ok: false,
      error:
        draft?.status === "paused"
          ? "Draft is paused."
          : "Draft is not live.",
      reason: "other",
    };
  }

  const seasonTeams = await getSeasonDraftTeams(season.id);
  const draftSettings = resolveDraftSettings(season.settings.draft);
  const teamsWithSlots = seasonTeams
    .filter((team) => team.draftSlot != null)
    .map((team) => ({
      id: team.id,
      name: team.name,
      draftSlot: team.draftSlot as number,
      autoPickEnabled: team.autoPickEnabled,
      userId: team.userId,
    }));

  const rounds = getDraftRounds(season.settings.rosterSlots, season.benchSlots);
  const schedule = buildDraftSchedule({
    teams: teamsWithSlots,
    rounds,
    style: draftSettings.style,
  });

  const slot = schedule[draft.currentPickIndex];
  if (!slot) {
    return { ok: true, overall: 0, playerFullName: "", teamName: "", isComplete: true };
  }

  const onClockTeam = teamsWithSlots.find((team) => team.id === slot.teamId);
  const isOpenSlot = onClockTeam?.userId == null;
  const now = Date.now();
  const clockExpired =
    draft.turnExpiresAt != null && draft.turnExpiresAt.getTime() <= now;

  // Claimed + autopick on: draft from queue as soon as this seat is on the clock.
  if (!isOpenSlot && onClockTeam?.autoPickEnabled) {
    const queuedPlayerId = await selectAutopickPlayerId({
      draftId: draft.id,
      currentPickIndex: draft.currentPickIndex,
      teamId: slot.teamId,
      seasonTeams: teamsWithSlots,
      settings: season.settings,
      benchSlots: season.benchSlots,
      scoringPreset: season.scoringPreset,
      queueOnly: true,
    });

    if (queuedPlayerId) {
      return commitAutopickPlayer({
        input,
        season,
        draft,
        seasonTeams,
        playerId: queuedPlayerId,
      });
    }

    // Queue empty — never BPA; wait for a manual pick (even after expiry).
    return {
      ok: false,
      error: "Queue is empty — waiting for a manual pick.",
      reason: "no_queue",
    };
  }

  if (!isOpenSlot && !onClockTeam?.autoPickEnabled) {
    return {
      ok: false,
      error: "Autopick is off for this team.",
      reason: "disabled",
    };
  }

  // Open / unclaimed seats — honour clock rules, then queue → BPA.
  if (input.enforceExpiry) {
    if (draft.turnExpiresAt != null) {
      if (!clockExpired) {
        return {
          ok: false,
          error: "The pick clock has not expired yet.",
          reason: "not_due",
        };
      }
    } else if (!isOpenSlot) {
      return {
        ok: false,
        error: "No pick clock and seat is claimed.",
        reason: "not_due",
      };
    }
  }

  const playerId = await selectAutopickPlayerId({
    draftId: draft.id,
    currentPickIndex: draft.currentPickIndex,
    teamId: slot.teamId,
    seasonTeams: teamsWithSlots,
    settings: season.settings,
    benchSlots: season.benchSlots,
    scoringPreset: season.scoringPreset,
    queueOnly: false,
  });

  if (!playerId) {
    return {
      ok: false,
      error: "No players left to autopick.",
      reason: "other",
    };
  }

  return commitAutopickPlayer({
    input,
    season,
    draft,
    seasonTeams,
    playerId,
  });
}

async function commitAutopickPlayer(args: {
  input: {
    leagueSeasonId: string;
    leaguePublicId: string;
    leagueName: string;
    madeByUserId: string | null;
    syncAlerts?: boolean;
  };
  season: {
    id: string;
    settings: (typeof leagueSeasons.$inferSelect)["settings"];
    benchSlots: number;
    irEnabled: boolean;
    taxiEnabled: boolean;
    pickTimeLimitSeconds: number;
    scoringPreset: string;
    regularSeasonEndWeek: number;
    playoffTeamCount: number;
  };
  draft: NonNullable<Awaited<ReturnType<typeof getDraftBySeasonId>>>;
  seasonTeams: Awaited<ReturnType<typeof getSeasonDraftTeams>>;
  playerId: string;
}): Promise<RunDraftAutopickResult> {
  const { input, season, draft, seasonTeams, playerId } = args;

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
    playerId,
    madeByUserId: input.madeByUserId,
    source: "autopick",
  });

  if (!committed.ok) {
    return { ok: false, error: committed.error, reason: "other" };
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
    leaguePublicId: input.leaguePublicId,
    leagueName: input.leagueName,
    draftId: draft.id,
    nextPickIndex: committed.nextPickIndex,
    scheduleLength: committed.scheduleLength,
    seasonTeams,
    sync: input.syncAlerts,
  });

  revalidatePath(`/league/${input.leaguePublicId}/draft`);
  revalidatePath(`/league/${input.leaguePublicId}/players`);
  revalidatePath(`/league/${input.leaguePublicId}/team`);
  revalidatePath(`/league/${input.leaguePublicId}/activity`);
  revalidatePath(`/league/${input.leaguePublicId}`);

  return {
    ok: true,
    overall: committed.overall,
    playerFullName: committed.playerFullName,
    teamName: committed.teamName,
    isComplete: committed.isComplete,
  };
}

export type ProcessExpiredDraftPicksResult = {
  checked: number;
  picked: number;
  skipped: number;
  errors: Array<{ seasonId: string; error: string }>;
  pauseWindows?: {
    checked: number;
    paused: number;
    resumed: number;
    errors: Array<{ seasonId: string; error: string }>;
  };
};

const MAX_PICKS_PER_DRAFT = 32;

/**
 * Drain eligible autopicks for one live draft (immediate queue seats, then
 * open/expired seats). Stops on not_due / disabled / no_queue / error.
 */
export async function drainDraftAutopick(input: {
  leagueSeasonId: string;
  leaguePublicId: string;
  leagueName: string;
  madeByUserId?: string | null;
  syncAlerts?: boolean;
}): Promise<{ picked: number; skipped: boolean; error?: string }> {
  let picked = 0;
  while (picked < MAX_PICKS_PER_DRAFT) {
    const draft = await getDraftBySeasonId(input.leagueSeasonId);
    if (!draft || draft.status !== "live") {
      break;
    }

    const outcome = await runDraftAutopick({
      leagueSeasonId: input.leagueSeasonId,
      leaguePublicId: input.leaguePublicId,
      leagueName: input.leagueName,
      enforceExpiry: true,
      madeByUserId: input.madeByUserId ?? null,
      syncAlerts: input.syncAlerts,
    });

    if (!outcome.ok) {
      if (
        outcome.reason === "not_due" ||
        outcome.reason === "disabled" ||
        outcome.reason === "no_queue"
      ) {
        return { picked, skipped: true };
      }
      return { picked, skipped: false, error: outcome.error };
    }

    picked += 1;
    if (outcome.isComplete) {
      break;
    }
  }

  return { picked, skipped: false };
}

/**
 * Autopick live draft seats:
 * - Claimed + autopick on + queue → pick immediately (even mid-clock)
 * - Open seats with expired/untimed clock → queue then BPA
 * Drains consecutive immediate queue picks in one pass.
 */
export async function processExpiredDraftPicks(
  now = new Date(),
): Promise<ProcessExpiredDraftPicksResult> {
  const pauseWindows = await applyDraftPauseWindows(now);

  const live = await db
    .select({
      seasonId: leagueSeasons.id,
      leaguePublicId: leagues.publicId,
      leagueName: leagues.name,
      draftId: drafts.id,
      turnExpiresAt: drafts.turnExpiresAt,
    })
    .from(drafts)
    .innerJoin(leagueSeasons, eq(leagueSeasons.id, drafts.leagueSeasonId))
    .innerJoin(leagues, eq(leagues.id, leagueSeasons.leagueId))
    .where(eq(drafts.status, "live"));

  const result: ProcessExpiredDraftPicksResult = {
    checked: live.length,
    picked: 0,
    skipped: 0,
    errors: [...pauseWindows.errors],
    pauseWindows: {
      checked: pauseWindows.checked,
      paused: pauseWindows.paused,
      resumed: pauseWindows.resumed,
      errors: pauseWindows.errors,
    },
  };

  for (const row of live) {
    const drained = await drainDraftAutopick({
      leagueSeasonId: row.seasonId,
      leaguePublicId: row.leaguePublicId,
      leagueName: row.leagueName,
      madeByUserId: null,
      syncAlerts: true,
    });
    result.picked += drained.picked;
    if (drained.skipped) {
      result.skipped += 1;
    }
    if (drained.error) {
      result.errors.push({
        seasonId: row.seasonId,
        error: drained.error,
      });
    }
  }

  return result;
}
