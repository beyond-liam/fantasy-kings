import { and, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { drafts, leagueSeasons, leagues } from "@/db/schema";
import type { DraftSettings, LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import { activateDraftLive } from "@/lib/leagues/draft/activate";
import { secondsUntil } from "@/lib/leagues/draft/clock";
import { resolveDraftSettings } from "@/lib/leagues/draft-settings";
import { getSeasonDraftTeams } from "@/lib/queries/draft";

const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function utcMinutesOfDay(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function parseUtcHhMm(value: string): number | null {
  if (!HH_MM_REGEX.test(value)) {
    return null;
  }
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Whether `now` falls in the daily UTC pause window.
 * Overnight wrap (start > end, e.g. 22:00→08:00) is supported.
 * Equal start/end is treated as no window.
 */
export function isWithinPauseWindow(
  now: Date,
  startHhMm: string,
  endHhMm: string,
): boolean {
  const start = parseUtcHhMm(startHhMm);
  const end = parseUtcHhMm(endHhMm);
  if (start == null || end == null || start === end) {
    return false;
  }

  const current = utcMinutesOfDay(now);
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

export type ApplyDraftPauseWindowsResult = {
  checked: number;
  paused: number;
  resumed: number;
  errors: Array<{ seasonId: string; error: string }>;
};

/**
 * Auto-pause / resume timed email drafts for their configured UTC pause window.
 * Manual commissioner pauses (`pausedByWindow = false`) are left alone.
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
    if (row.pickTimeLimitSeconds <= 0) {
      continue;
    }

    const window = resolveActivePauseWindow(
      row.draftType,
      row.pickTimeLimitSeconds,
      (row.settings as LeagueSeasonSettings).draft,
    );
    if (!window) {
      continue;
    }

    result.checked += 1;
    const inWindow = isWithinPauseWindow(now, window.start, window.end);

    try {
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
        result.paused += 1;
        continue;
      }

      if (
        row.draftStatus === "paused" &&
        row.pausedByWindow &&
        !inWindow
      ) {
        const seasonTeams = await getSeasonDraftTeams(row.seasonId);
        const activated = await activateDraftLive({
          seasonId: row.seasonId,
          seasonStatus: row.seasonStatus,
          seasonTeams,
          pickTimeLimitSeconds: row.pickTimeLimitSeconds,
          allowResume: true,
        });
        if (!activated.ok) {
          result.errors.push({
            seasonId: row.seasonId,
            error: activated.error,
          });
          continue;
        }
        revalidatePath(`/league/${row.leaguePublicId}/draft`);
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
