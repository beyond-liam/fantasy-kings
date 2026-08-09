"use server";

import { eq } from "drizzle-orm";

import { leagueSeasons } from "@/db/schema";
import type { LineupLockMode } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import { lineupLockModeSchema } from "@/lib/leagues/lineup-lock";
import {
  diffSettingsValues,
  logSettingsUpdated,
} from "@/lib/leagues/settings-activity";

import {
  getCommissionerSeason,
  revalidateSettingsPaths,
  type ActionResult,
} from "./_shared";

export async function updateLineupLockMode(
  slug: string,
  lineupLockMode: LineupLockMode,
): Promise<ActionResult> {
  const parsed = lineupLockModeSchema.safeParse(lineupLockMode);
  if (!parsed.success) {
    return { success: false, error: "Invalid lineup lock mode." };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season, user } = result;

  await db
    .update(leagueSeasons)
    .set({
      settings: {
        ...season.settings,
        lineupLockMode: parsed.data,
      },
    })
    .where(eq(leagueSeasons.id, season.id));

  await logSettingsUpdated({
    leagueSeasonId: season.id,
    actorUserId: user.id,
    section: "lineup_lock",
    label: "lineup locking",
    changes: diffSettingsValues(
      { lineupLockMode: season.settings.lineupLockMode ?? null },
      { lineupLockMode: parsed.data },
      [{ path: "lineupLockMode", label: "Lineup lock mode" }],
    ),
  });

  revalidateSettingsPaths(slug);

  return { success: true };
}
