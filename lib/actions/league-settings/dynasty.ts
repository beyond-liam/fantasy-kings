"use server";

import { eq } from "drizzle-orm";

import { leagueSeasons } from "@/db/schema";
import { db } from "@/lib/db";
import {
  clampDynastyKeepersToRosterCap,
  dynastySettingsSchema,
  maxCountingKeepersCap,
  resolveDynastySettings,
  toPersistedDynastySettings,
  type DynastySettingsFormValues,
} from "@/lib/leagues/dynasty-settings";
import { getMaxRosterSize } from "@/lib/leagues/roster-capacity";
import {
  diffSettingsValues,
  logSettingsUpdated,
  type SettingsFieldDef,
} from "@/lib/leagues/settings-activity";

import {
  getCommissionerSeason,
  revalidateSettingsPaths,
  type ActionResult,
} from "./_shared";

export async function updateDynastySettings(
  slug: string,
  values: DynastySettingsFormValues,
): Promise<ActionResult> {
  const parsed = dynastySettingsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid dynasty settings.",
    };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season, user } = result;
  if (season.leagueType !== "dynasty") {
    return {
      success: false,
      error: "Dynasty settings are only available for dynasty leagues.",
    };
  }

  const rosterCap = {
    activeRosterSize: getMaxRosterSize(
      season.settings.rosterSlots,
      season.benchSlots,
    ),
    irSlots: season.irEnabled ? season.irSlots : 0,
    taxiSlots: season.taxiEnabled ? season.taxiSlots : 0,
  };
  const after = clampDynastyKeepersToRosterCap(
    toPersistedDynastySettings(parsed.data),
    rosterCap,
  );
  const countingCap = maxCountingKeepersCap(rosterCap, after);
  if (parsed.data.keepersMax != null && parsed.data.keepersMax > countingCap) {
    return {
      success: false,
      error: `Keepers max cannot exceed ${countingCap} with current IR/Taxi counting rules.`,
    };
  }

  const before = resolveDynastySettings(season.settings.dynasty);
  const fields: SettingsFieldDef[] = [
    {
      path: "keepersMax",
      label: "Keepers max",
      format: (value) => (value == null ? "Not set" : String(value)),
    },
    {
      path: "keepersMin",
      label: "Keepers min",
      format: (value) => (value == null ? "Off" : String(value)),
    },
    {
      path: "keeperDeadlineAt",
      label: "Keeper deadline",
      format: (value) =>
        typeof value === "string" && value
          ? new Date(value).toLocaleString("en-GB", {
              timeZone: "Europe/London",
            })
          : "None",
    },
    {
      path: "irCountsTowardKeepers",
      label: "IR counts toward keepers",
    },
    {
      path: "taxiCountsTowardKeepers",
      label: "Taxi counts toward keepers",
    },
    { path: "futurePickTradeYears", label: "Future pick trade years" },
    {
      path: "draftPlayerPool",
      label: "Draft player pool",
      format: (value) =>
        value === "all" ? "All available players" : "Rookies only",
    },
  ];

  await db
    .update(leagueSeasons)
    .set({
      settings: {
        ...season.settings,
        dynasty: after,
      },
    })
    .where(eq(leagueSeasons.id, season.id));

  await logSettingsUpdated({
    leagueSeasonId: season.id,
    actorUserId: user.id,
    section: "dynasty",
    label: "dynasty rules",
    changes: diffSettingsValues(before, after, fields),
  });

  revalidateSettingsPaths(slug);

  return { success: true };
}
