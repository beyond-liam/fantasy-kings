"use server";

import { eq } from "drizzle-orm";

import { leagueSeasons } from "@/db/schema";
import { db } from "@/lib/db";
import {
  buildPersistedRosterSlots,
  rosterRequirementsSchema,
  type RosterRequirementsValues,
} from "@/lib/leagues/roster";
import {
  diffSettingsValues,
  logSettingsUpdated,
} from "@/lib/leagues/settings-activity";

import {
  getCommissionerSeason,
  revalidateSettingsPaths,
  type ActionResult,
} from "./_shared";

export async function updateRosterRequirements(
  slug: string,
  values: RosterRequirementsValues,
): Promise<ActionResult> {
  const parsed = rosterRequirementsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid roster settings.",
    };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season, user } = result;
  const next = parsed.data;
  const rosterSlots = buildPersistedRosterSlots(next);
  const before = {
    rosterMode: season.rosterMode,
    benchSlots: season.benchSlots,
    irEnabled: season.irEnabled,
    irSlots: season.irSlots,
    taxiEnabled: season.taxiEnabled,
    taxiSlots: season.taxiSlots,
    taxiMaxYearsExp: season.settings.taxiMaxYearsExp ?? null,
    irEligibleStatuses: season.settings.irEligibleStatuses ?? [],
  };
  const after = {
    rosterMode: next.rosterMode,
    benchSlots: next.benchSlots,
    irEnabled: next.irEnabled,
    irSlots: next.irEnabled ? next.irSlots : 0,
    taxiEnabled: next.taxiEnabled,
    taxiSlots: next.taxiEnabled ? next.taxiSlots : 0,
    taxiMaxYearsExp: next.taxiEnabled ? next.taxiMaxYearsExp : null,
    irEligibleStatuses: next.irEnabled ? next.irEligibleStatuses : [],
  };

  await db
    .update(leagueSeasons)
    .set({
      rosterMode: next.rosterMode,
      benchSlots: next.benchSlots,
      irEnabled: next.irEnabled,
      irSlots: next.irEnabled ? next.irSlots : 0,
      taxiEnabled: next.taxiEnabled,
      taxiSlots: next.taxiEnabled ? next.taxiSlots : 0,
      settings: {
        ...season.settings,
        rosterSlots,
        irEligibleStatuses: next.irEnabled
          ? next.irEligibleStatuses
          : season.settings.irEligibleStatuses,
        taxiMaxYearsExp: next.taxiEnabled
          ? next.taxiMaxYearsExp
          : season.settings.taxiMaxYearsExp,
      },
    })
    .where(eq(leagueSeasons.id, season.id));

  await logSettingsUpdated({
    leagueSeasonId: season.id,
    actorUserId: user.id,
    section: "roster",
    label: "Roster requirements",
    changes: diffSettingsValues(before, after, [
      { path: "rosterMode", label: "Roster mode" },
      { path: "benchSlots", label: "Bench slots" },
      { path: "irEnabled", label: "IR enabled" },
      { path: "irSlots", label: "IR slots" },
      { path: "taxiEnabled", label: "Taxi enabled" },
      { path: "taxiSlots", label: "Taxi slots" },
      { path: "taxiMaxYearsExp", label: "Taxi eligibility" },
      { path: "irEligibleStatuses", label: "IR eligible statuses" },
    ]),
  });

  revalidateSettingsPaths(slug);

  return { success: true };
}
