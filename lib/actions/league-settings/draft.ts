"use server";

import { asc, eq } from "drizzle-orm";

import { leagueSeasons, teams } from "@/db/schema";
import { db } from "@/lib/db";
import { getDraftRounds } from "@/lib/leagues/draft/board";
import { unwindDraftForFutureStart } from "@/lib/leagues/draft/reschedule";
import { ensureDraftTurnClock } from "@/lib/leagues/draft/ensure-turn-clock";
import { syncDraftPauseWindowForSeason } from "@/lib/leagues/draft/pause-window";
import {
  draftConfigFormSchema,
  draftConfigPickTimeSeconds,
  resolveDraftSettings,
  resolveDraftType,
  toPersistedDraftSettings,
  withPreservedAutopickBackfill,
  type DraftConfigFormValues,
} from "@/lib/leagues/draft-settings";
import {
  isDynastyStartupSeason,
  maxConfigurableDynastyDraftRounds,
  resolveDynastySettings,
} from "@/lib/leagues/dynasty-settings";
import {
  diffSettingsValues,
  logSettingsUpdated,
} from "@/lib/leagues/settings-activity";
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
  const isDynasty = season.leagueType === "dynasty";
  const dynasty = isDynasty
    ? resolveDynastySettings(season.settings.dynasty)
    : null;
  const rosterCap = getDraftRounds(
    season.settings.rosterSlots,
    season.benchSlots,
  );
  const maxRounds = dynasty
    ? maxConfigurableDynastyDraftRounds({
        rosterCap,
        keepersMax: dynasty.keepersMax,
        isStartup: isDynastyStartupSeason(dynasty),
      })
    : rosterCap;
  const nextRounds = dynasty
    ? isDynastyStartupSeason(dynasty)
      ? maxRounds
      : Math.min(Math.max(0, next.draftRounds ?? maxRounds), maxRounds)
    : undefined;
  const nextPool =
    dynasty &&
    (next.draftPlayerPool === "rookies" || next.draftPlayerPool === "all")
      ? next.draftPlayerPool
      : dynasty?.draftPlayerPool;
  const nextDynasty =
    dynasty && nextPool
      ? { ...dynasty, draftPlayerPool: nextPool }
      : season.settings.dynasty;
  const before = {
    draftType: season.draftType,
    draftStartAt: season.draftStartAt.toISOString(),
    pickTimeLimitSeconds: season.pickTimeLimitSeconds,
    draftStyle: beforeDraft.style,
    pickTimeLimitEnabled: beforeDraft.pickTimeLimitEnabled ?? true,
    pauseWindowEnabled: beforeDraft.pauseWindowEnabled ?? false,
    pauseWindowStart: beforeDraft.pauseWindowStart ?? null,
    pauseWindowEnd: beforeDraft.pauseWindowEnd ?? null,
    forceAutopickAfterTwoExpires:
      beforeDraft.forceAutopickAfterTwoExpires ?? false,
    ...(dynasty
      ? {
          draftRounds: beforeDraft.rounds ?? maxRounds,
          draftPlayerPool: dynasty.draftPlayerPool,
        }
      : {}),
  };
  const afterSettings = toPersistedDraftSettings({
    ...next,
    ...(nextRounds != null ? { draftRounds: nextRounds } : {}),
  });
  const after = {
    draftType: next.draftType,
    draftStartAt: draftStartAt.toISOString(),
    pickTimeLimitSeconds: draftConfigPickTimeSeconds(next),
    draftStyle: afterSettings.style,
    pickTimeLimitEnabled: afterSettings.pickTimeLimitEnabled ?? true,
    pauseWindowEnabled: afterSettings.pauseWindowEnabled ?? false,
    pauseWindowStart: afterSettings.pauseWindowEnabled
      ? (afterSettings.pauseWindowStart ?? null)
      : null,
    pauseWindowEnd: afterSettings.pauseWindowEnabled
      ? (afterSettings.pauseWindowEnd ?? null)
      : null,
    forceAutopickAfterTwoExpires: Boolean(
      afterSettings.forceAutopickAfterTwoExpires,
    ),
    ...(dynasty
      ? {
          draftRounds: nextRounds ?? maxRounds,
          draftPlayerPool: nextPool ?? dynasty.draftPlayerPool,
        }
      : {}),
  };

  await db
    .update(leagueSeasons)
    .set({
      draftType: next.draftType,
      draftStartAt,
      pickTimeLimitSeconds: draftConfigPickTimeSeconds(next),
      settings: {
        ...season.settings,
        draft: withPreservedAutopickBackfill(afterSettings, beforeDraft),
        ...(isDynasty ? { dynasty: nextDynasty } : {}),
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
    if (afterSettings.forceAutopickAfterTwoExpires) {
      const { ensureForcedAutopickStreakBackfill } = await import(
        "@/lib/leagues/draft/backfill-forced-autopick"
      );
      await ensureForcedAutopickStreakBackfill({
        leagueSeasonId: season.id,
        draftId: liveDraft.id,
        settings: {
          ...season.settings,
          draft: withPreservedAutopickBackfill(afterSettings, beforeDraft),
        },
      });
    }
    await ensureDraftTurnClock({
      draft: liveDraft,
      pickTimeLimitSeconds: after.pickTimeLimitSeconds,
    });
  }

  // Honor the new pause window immediately (e.g. resume if end time already passed).
  await syncDraftPauseWindowForSeason(season.id);

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
      { path: "pauseWindowEnabled", label: "Pause window enabled" },
      { path: "pauseWindowStart", label: "Pause window start (UK)" },
      { path: "pauseWindowEnd", label: "Pause window end (UK)" },
      {
        path: "forceAutopickAfterTwoExpires",
        label: "Force autopick after two missed picks",
      },
      { path: "draftRounds", label: "Draft rounds" },
      {
        path: "draftPlayerPool",
        label: "Draft player pool",
        format: (value) =>
          value === "all" ? "All available players" : "Rookies only",
      },
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
