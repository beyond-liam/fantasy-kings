"use server";

import { asc, eq } from "drizzle-orm";

import { leagueSeasons, teams } from "@/db/schema";
import { db } from "@/lib/db";
import {
  draftConfigFormSchema,
  draftConfigPickTimeSeconds,
  resolveDraftSettings,
  resolveDraftType,
  toPersistedDraftSettings,
  type DraftConfigFormValues,
} from "@/lib/leagues/draft-settings";
import {
  diffSettingsValues,
  logSettingsUpdated,
} from "@/lib/leagues/settings-activity";
import { unwindDraftForFutureStart } from "@/lib/leagues/draft/reschedule";
import { ensureDraftTurnClock } from "@/lib/leagues/draft/ensure-turn-clock";
import { getDraftBySeasonId } from "@/lib/queries/draft";

import {
  getCommissionerSeason,
  revalidateSettingsPaths,
  type ActionResult,
} from "./_shared";

export async function updateDraftConfig(
  slug: string,
  values: DraftConfigFormValues,
): Promise<ActionResult> {
  const parsed = draftConfigFormSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid draft settings.",
    };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season, user } = result;
  const next = {
    ...parsed.data,
    draftType: resolveDraftType(parsed.data.draftType),
  };
  const draftStartAt = new Date(next.draftStartAt);
  const beforeDraft = resolveDraftSettings(season.settings.draft);
  const before = {
    draftType: season.draftType,
    draftStartAt: season.draftStartAt.toISOString(),
    pickTimeLimitSeconds: season.pickTimeLimitSeconds,
    draftStyle: beforeDraft.style,
    pickTimeLimitEnabled: beforeDraft.pickTimeLimitEnabled ?? true,
    autoPickEnabled: beforeDraft.autoPickEnabled,
  };
  const afterSettings = toPersistedDraftSettings(next);
  const after = {
    draftType: next.draftType,
    draftStartAt: draftStartAt.toISOString(),
    pickTimeLimitSeconds: draftConfigPickTimeSeconds(next),
    draftStyle: afterSettings.style,
    pickTimeLimitEnabled: afterSettings.pickTimeLimitEnabled ?? true,
    autoPickEnabled: afterSettings.autoPickEnabled,
  };

  await db
    .update(leagueSeasons)
    .set({
      draftType: next.draftType,
      draftStartAt,
      pickTimeLimitSeconds: draftConfigPickTimeSeconds(next),
      settings: {
        ...season.settings,
        draft: afterSettings,
      },
    })
    .where(eq(leagueSeasons.id, season.id));

  await unwindDraftForFutureStart({
    seasonId: season.id,
    seasonStatus: season.status,
    draftStartAt,
  });

  const liveDraft = await getDraftBySeasonId(season.id);
  if (
    liveDraft &&
    (liveDraft.status === "live" || liveDraft.status === "paused")
  ) {
    await ensureDraftTurnClock({
      draft: liveDraft,
      pickTimeLimitSeconds: after.pickTimeLimitSeconds,
    });
  }

  // Apply league autopick default to all teams.
  await db
    .update(teams)
    .set({ autoPickEnabled: afterSettings.autoPickEnabled })
    .where(eq(teams.leagueSeasonId, season.id));

  await logSettingsUpdated({
    leagueSeasonId: season.id,
    actorUserId: user.id,
    section: "draft",
    label: "draft settings",
    changes: diffSettingsValues(before, after, [
      { path: "draftType", label: "Draft type" },
      { path: "draftStartAt", label: "Draft start" },
      { path: "draftStyle", label: "Draft style" },
      { path: "pickTimeLimitEnabled", label: "Pick time limit enabled" },
      { path: "pickTimeLimitSeconds", label: "Pick time (seconds)" },
      { path: "autoPickEnabled", label: "Auto-pick default" },
    ]),
  });

  revalidateSettingsPaths(slug);
  return { success: true };
}

export async function updateDraftOrder(
  slug: string,
  teamIdsInOrder: string[],
): Promise<ActionResult> {
  if (!Array.isArray(teamIdsInOrder) || teamIdsInOrder.length === 0) {
    return { success: false, error: "Draft order is empty." };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;

  if (season.status === "active") {
    return {
      success: false,
      error: "Draft order can't be changed after the season is active.",
    };
  }

  const existing = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.leagueSeasonId, season.id));

  const existingIds = new Set(existing.map((row) => row.id));
  if (teamIdsInOrder.length !== existingIds.size) {
    return { success: false, error: "Draft order must include every team." };
  }
  for (const id of teamIdsInOrder) {
    if (!existingIds.has(id)) {
      return { success: false, error: "Draft order includes an unknown team." };
    }
  }

  for (let index = 0; index < teamIdsInOrder.length; index++) {
    await db
      .update(teams)
      .set({ draftSlot: index + 1 })
      .where(eq(teams.id, teamIdsInOrder[index]!));
  }

  revalidateSettingsPaths(slug);
  return { success: true };
}

export async function randomizeDraftOrder(
  slug: string,
): Promise<ActionResult> {
  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;

  if (season.status === "active") {
    return {
      success: false,
      error: "Draft order can't be changed after the season is active.",
    };
  }

  const existing = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.leagueSeasonId, season.id))
    .orderBy(asc(teams.createdAt));

  const shuffled = [...existing.map((row) => row.id)];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }

  for (let index = 0; index < shuffled.length; index++) {
    await db
      .update(teams)
      .set({ draftSlot: index + 1 })
      .where(eq(teams.id, shuffled[index]!));
  }

  revalidateSettingsPaths(slug);
  return { success: true, teamIds: shuffled };
}
