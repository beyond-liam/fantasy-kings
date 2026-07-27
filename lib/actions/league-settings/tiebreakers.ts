"use server";

import { eq } from "drizzle-orm";

import { leagueSeasons } from "@/db/schema";
import { db } from "@/lib/db";
import {
  diffSettingsValues,
  logSettingsUpdated,
  type SettingsFieldDef,
} from "@/lib/leagues/settings-activity";
import {
  GAME_TIEBREAKER_OPTIONS,
  RANK_TIEBREAKER_OPTIONS,
  resolveTiebreakerSettings,
  tiebreakerSettingsSchema,
  type TiebreakerSettings,
} from "@/lib/leagues/tiebreakers";

import {
  getCommissionerSeason,
  revalidateSettingsPaths,
  type ActionResult,
} from "./_shared";

export async function updateTiebreakerSettings(
  slug: string,
  values: TiebreakerSettings,
): Promise<ActionResult> {
  const parsed = tiebreakerSettingsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid tiebreak settings.",
    };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season, user } = result;

  const before = resolveTiebreakerSettings(season.settings.tiebreakers);
  const after = parsed.data;
  const fields: SettingsFieldDef[] = [
    { path: "breakRegularSeasonTies", label: "Break regular-season ties" },
    { path: "applyOfficialStatChanges", label: "Allow official score corrections" },
    {
      path: "gameTiebreakers",
      label: "Game tiebreaker order",
      format: (value) =>
        Array.isArray(value)
          ? value
              .map(
                (id) =>
                  GAME_TIEBREAKER_OPTIONS.find((option) => option.id === id)
                    ?.label ?? String(id),
              )
              .join(" → ")
          : "—",
    },
    {
      path: "rankTiebreakers",
      label: "Rank tiebreaker order",
      format: (value) =>
        Array.isArray(value)
          ? value
              .map(
                (id) =>
                  RANK_TIEBREAKER_OPTIONS.find((option) => option.id === id)
                    ?.label ?? String(id),
              )
              .join(" → ")
          : "—",
    },
  ];

  await db
    .update(leagueSeasons)
    .set({
      settings: {
        ...season.settings,
        tiebreakers: parsed.data,
      },
    })
    .where(eq(leagueSeasons.id, season.id));

  await logSettingsUpdated({
    leagueSeasonId: season.id,
    actorUserId: user.id,
    section: "tiebreakers",
    label: "Tiebreakers",
    changes: diffSettingsValues(before, after, fields),
  });

  revalidateSettingsPaths(slug);

  return { success: true };
}
