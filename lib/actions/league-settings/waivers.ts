"use server";

import { and, eq, isNull } from "drizzle-orm";

import { leagueSeasons, teams } from "@/db/schema";
import { db } from "@/lib/db";
import {
  diffSettingsValues,
  logSettingsUpdated,
} from "@/lib/leagues/settings-activity";
import { resolveTransactionRules } from "@/lib/leagues/transaction-rules";
import {
  resolveWaiverWireSettings,
  toPersistedWaiverWire,
  waiverWireFormSchema,
  type WaiverWireFormValues,
} from "@/lib/leagues/waiver-wire";
import { getDraftBySeasonId } from "@/lib/queries/draft";

import {
  getCommissionerSeason,
  revalidateSettingsPaths,
  type ActionResult,
} from "./_shared";

export async function updateWaiverWireRules(
  slug: string,
  values: WaiverWireFormValues,
): Promise<ActionResult> {
  const parsed = waiverWireFormSchema.safeParse(values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false,
      error: issue?.message ?? "Invalid waiver settings.",
      fieldError:
        issue?.path[0] === "processDays" || issue?.path[0] === "faabBudget"
          ? issue.message
          : undefined,
    };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season, user } = result;
  const next = parsed.data;
  const draft = await getDraftBySeasonId(season.id);
  const draftComplete = draft?.status === "complete";
  if (next.preseasonWaivers && !draftComplete) {
    return {
      success: false,
      error: "Preseason waivers can only be enabled after the draft is complete.",
      fieldError: "Preseason waivers can only be enabled after the draft is complete.",
    };
  }
  const beforeWire = resolveWaiverWireSettings(
    season.settings.waiverWire,
    season.settings.transactionRules?.preseasonFreeAgents,
  );
  const before = {
    waiversEnabled: season.waiversEnabled,
    waiverType: season.waiverType,
    faabBudget: season.faabBudget,
    processDays: beforeWire.processDays,
    dropWaiverHours: beforeWire.dropWaiverHours,
    resetOrderWeekly: beforeWire.resetOrderWeekly,
    dailyDropProcessing: beforeWire.dailyDropProcessing,
    preseasonWaivers: beforeWire.preseasonWaivers,
  };
  const afterWire = toPersistedWaiverWire(next);
  const after = {
    waiversEnabled: next.waiversEnabled,
    waiverType: next.waiverType,
    faabBudget:
      next.waiversEnabled && next.waiverType === "faab" ? next.faabBudget : null,
    processDays: afterWire.processDays,
    dropWaiverHours: afterWire.dropWaiverHours,
    resetOrderWeekly: afterWire.resetOrderWeekly,
    dailyDropProcessing: afterWire.dailyDropProcessing,
    preseasonWaivers: afterWire.preseasonWaivers,
  };

  // Keep legacy transaction-rules field in sync for older readers.
  const nextTransactionRules = {
    ...resolveTransactionRules(season.settings.transactionRules),
    preseasonFreeAgents: afterWire.preseasonWaivers
      ? ("always_on_waivers" as const)
      : ("unlocked" as const),
  };

  await db
    .update(leagueSeasons)
    .set({
      waiversEnabled: next.waiversEnabled,
      waiverType: next.waiverType,
      faabBudget:
        next.waiversEnabled && next.waiverType === "faab"
          ? next.faabBudget
          : null,
      settings: {
        ...season.settings,
        waiverWire: afterWire,
        transactionRules: nextTransactionRules,
      },
    })
    .where(eq(leagueSeasons.id, season.id));

  // Seed FAAB only for teams that don't have a budget yet (don't reset spends).
  if (next.waiversEnabled && next.waiverType === "faab") {
    await db
      .update(teams)
      .set({ faabRemaining: next.faabBudget })
      .where(
        and(eq(teams.leagueSeasonId, season.id), isNull(teams.faabRemaining)),
      );
  } else {
    await db
      .update(teams)
      .set({ faabRemaining: null })
      .where(eq(teams.leagueSeasonId, season.id));
  }

  await logSettingsUpdated({
    leagueSeasonId: season.id,
    actorUserId: user.id,
    section: "waivers",
    label: "waiver wire",
    changes: diffSettingsValues(before, after, [
      { path: "waiversEnabled", label: "Waivers enabled" },
      { path: "waiverType", label: "Waiver type" },
      { path: "faabBudget", label: "FAAB budget" },
      { path: "processDays", label: "Process days" },
      { path: "dropWaiverHours", label: "Drop waiver hours" },
      { path: "resetOrderWeekly", label: "Reset order weekly" },
      { path: "dailyDropProcessing", label: "Daily drop processing" },
      { path: "preseasonWaivers", label: "Preseason waivers" },
    ]),
  });

  revalidateSettingsPaths(slug);

  return { success: true };
}

export async function updateWaiverOrder(
  slug: string,
  teamIdsInOrder: string[],
): Promise<ActionResult> {
  if (!Array.isArray(teamIdsInOrder) || teamIdsInOrder.length === 0) {
    return { success: false, error: "Waiver order is empty." };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;

  const existing = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.leagueSeasonId, season.id));

  const existingIds = new Set(existing.map((row) => row.id));
  if (teamIdsInOrder.length !== existingIds.size) {
    return { success: false, error: "Waiver order must include every team." };
  }
  for (const id of teamIdsInOrder) {
    if (!existingIds.has(id)) {
      return { success: false, error: "Waiver order includes an unknown team." };
    }
  }

  for (let index = 0; index < teamIdsInOrder.length; index++) {
    await db
      .update(teams)
      .set({ waiverPriority: index + 1 })
      .where(eq(teams.id, teamIdsInOrder[index]!));
  }

  revalidateSettingsPaths(slug);
  return { success: true };
}
