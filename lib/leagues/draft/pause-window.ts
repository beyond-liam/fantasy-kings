import { and, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { drafts, leagueSeasons, leagues } from "@/db/schema";
import type {
  DraftSettings,
  LeagueSeasonSettings,
} from "@/db/schema/league-seasons";
import { ukMinutesOfDay } from "@/lib/datetime/uk-time";
import { db } from "@/lib/db";
import { activateDraftLive } from "@/lib/leagues/draft/activate";
import { secondsUntil } from "@/lib/leagues/draft/clock";
import { resolveDraftSettings } from "@/lib/leagues/draft-settings";
import { getSeasonDraftTeams } from "@/lib/queries/draft";

const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function parseUkHhMm(value: string): number | null {
  if (!HH_MM_REGEX.test(value)) {
    return null;
  }
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Whether `now` falls in the daily UK (`Europe/London`) pause window.
 * Overnight wrap (start > end, e.g. 22:00→08:00) is supported.
 * Equal start/end is treated as no window.
 */
export function isWithinPauseWindow(
  now: Date,
  startHhMm: string,
  endHhMm: string,
): boolean {
  const start = parseUkHhMm(startHhMm);
  const end = parseUkHhMm(endHhMm);
  if (start == null || end == null || start === end) {
    return false;
  }

  const current = ukMinutesOfDay(now);
  if (start < end) {
    return current >= start && current < end;
  }
  return current >= start || current < end;
}

export function resolveActivePauseWindow(
  draftType: "live" | "email",
  pickTimeLimitSeconds: number,
  draft?: DraftSettings | null,
): { start: string; end: string } | null {
  if (draftType !== "email" || pickTimeLimitSeconds <= 0) {
    return null;
  }
  const settings = resolveDraftSettings(draft);
  if (!settings.pauseWindowEnabled) {
    return null;
  }
  const start = settings.pauseWindowStart;
  const end = settings.pauseWindowEnd;
  if (!start || !end || start === end) {
    return null;
  }
  return { start, end };
}

type PauseWindowDraftRow = {
  seasonId: string;
  seasonStatus: string;
  draftType: "live" | "email";
  pickTimeLimitSeconds: number;
  settings: LeagueSeasonSettings;
  leaguePublicId: string;
  draftId: string;
  draftStatus: string;
  turnExpiresAt: Date | null;
  pausedByWindow: boolean;
};

export type SyncDraftPauseWindowResult = {
  action: "paused" | "resumed" | "none";
  error?: string;
};

async function applyPauseWindowToRow(
  row: PauseWindowDraftRow,
  now: Date,
): Promise<SyncDraftPauseWindowResult> {
  if (row.pickTimeLimitSeconds <= 0) {
    return { action: "none" };
  }

  const window = resolveActivePauseWindow(
    row.draftType,
    row.pickTimeLimitSeconds,
    row.settings.draft,
  );
  if (!window) {
    return { action: "none" };
  }

  const inWindow = isWithinPauseWindow(now, window.start, window.end);

  if (row.draftStatus === "live" && inWindow) {
    let pausedSecondsRemaining: number | null = null;
    if (row.turnExpiresAt) {
      pausedSecondsRemaining = secondsUntil(row.turnExpiresAt, now);
    } else {
      pausedSecondsRemaining = row.pickTimeLimitSeconds;
    }

    await db
      .update(drafts)
      .set({
        status: "paused",
        pausedAt: now,
        turnExpiresAt: null,
        pausedSecondsRemaining,
        pausedByWindow: true,
      })
      .where(eq(drafts.id, row.draftId));

    revalidatePath(`/league/${row.leaguePublicId}/draft`);
    return { action: "paused" };
  }

  if (row.draftStatus === "paused" && row.pausedByWindow && !inWindow) {
    const seasonTeams = await getSeasonDraftTeams(row.seasonId);
    const activated = await activateDraftLive({
      seasonId: row.seasonId,
      seasonStatus: row.seasonStatus,
      seasonTeams,
      pickTimeLimitSeconds: row.pickTimeLimitSeconds,
      allowResume: true,
    });
    if (!activated.ok) {
      return { action: "none", error: activated.error };
    }
    revalidatePath(`/league/${row.leaguePublicId}/draft`);
    return { action: "resumed" };
  }

  return { action: "none" };
}

/**
 * Sync pause/resume for one season's timed email draft.
 * Safe to call from draft poll, settings save, and page load.
 */
export async function syncDraftPauseWindowForSeason(
  seasonId: string,
  now = new Date(),
): Promise<SyncDraftPauseWindowResult> {
  const [row] = await db
    .select({
      seasonId: leagueSeasons.id,
      seasonStatus: leagueSeasons.status,
      draftType: leagueSeasons.draftType,
      pickTimeLimitSeconds: leagueSeasons.pickTimeLimitSeconds,
      settings: leagueSeasons.settings,
      leaguePublicId: leagues.publicId,
      draftId: drafts.id,
      draftStatus: drafts.status,
      turnExpiresAt: drafts.turnExpiresAt,
      pausedByWindow: drafts.pausedByWindow,
    })
    .from(drafts)
    .innerJoin(leagueSeasons, eq(leagueSeasons.id, drafts.leagueSeasonId))
    .innerJoin(leagues, eq(leagues.id, leagueSeasons.leagueId))
    .where(
      and(
        eq(leagueSeasons.id, seasonId),
        eq(leagueSeasons.draftType, "email"),
        or(eq(drafts.status, "live"), eq(drafts.status, "paused")),
      ),
    )
    .limit(1);

  if (!row) {
    return { action: "none" };
  }

  try {
    return await applyPauseWindowToRow(
      {
        ...row,
        settings: row.settings as LeagueSeasonSettings,
      },
      now,
    );
  } catch (error) {
    return {
      action: "none",
      error: error instanceof Error ? error.message : "Pause window failed.",
    };
  }
}

export type ApplyDraftPauseWindowsResult = {
  checked: number;
  paused: number;
  resumed: number;
  errors: Array<{ seasonId: string; error: string }>;
};

/**
 * Auto-pause / resume timed email drafts for their configured UK pause window.
 * Window pause freezes the pick clock only; commissioner pauses
 * (`pausedByWindow = false`) still block picks and are left alone.
 */
export async function applyDraftPauseWindows(
  now = new Date(),
): Promise<ApplyDraftPauseWindowsResult> {
  const rows = await db
    .select({
      seasonId: leagueSeasons.id,
      seasonStatus: leagueSeasons.status,
      draftType: leagueSeasons.draftType,
      pickTimeLimitSeconds: leagueSeasons.pickTimeLimitSeconds,
      settings: leagueSeasons.settings,
      leaguePublicId: leagues.publicId,
      draftId: drafts.id,
      draftStatus: drafts.status,
      turnExpiresAt: drafts.turnExpiresAt,
      pausedByWindow: drafts.pausedByWindow,
    })
    .from(drafts)
    .innerJoin(leagueSeasons, eq(leagueSeasons.id, drafts.leagueSeasonId))
    .innerJoin(leagues, eq(leagues.id, leagueSeasons.leagueId))
    .where(
      and(
        eq(leagueSeasons.draftType, "email"),
        or(eq(drafts.status, "live"), eq(drafts.status, "paused")),
      ),
    );

  const result: ApplyDraftPauseWindowsResult = {
    checked: 0,
    paused: 0,
    resumed: 0,
    errors: [],
  };

  for (const row of rows) {
    const window = resolveActivePauseWindow(
      row.draftType,
      row.pickTimeLimitSeconds,
      (row.settings as LeagueSeasonSettings).draft,
    );
    if (!window || row.pickTimeLimitSeconds <= 0) {
      continue;
    }

    result.checked += 1;

    try {
      const synced = await applyPauseWindowToRow(
        {
          ...row,
          settings: row.settings as LeagueSeasonSettings,
        },
        now,
      );
      if (synced.error) {
        result.errors.push({ seasonId: row.seasonId, error: synced.error });
        continue;
      }
      if (synced.action === "paused") {
        result.paused += 1;
      } else if (synced.action === "resumed") {
        result.resumed += 1;
      }
    } catch (error) {
      result.errors.push({
        seasonId: row.seasonId,
        error: error instanceof Error ? error.message : "Pause window failed.",
      });
    }
  }

  return result;
}
