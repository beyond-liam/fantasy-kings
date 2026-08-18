"use server";

import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { rosterPlayers, teams } from "@/db/schema";
import { db } from "@/lib/db";
import { logLeagueActivity } from "@/lib/leagues/activity-log";
import { loadLeagueActionContext } from "@/lib/leagues/action-context";
import {
  areKeepersLocked,
  resolveDynastySettings,
  validateKeeperSelection,
} from "@/lib/leagues/dynasty-settings";
import { clearNonKeepersForSeason } from "@/lib/leagues/keepers/process";

const updateTeamKeepersSchema = z.object({
  keeperPlayerIds: z.array(z.string().uuid()),
  teamId: z.string().uuid().optional(),
});

export type KeepersActionResult = {
  success: boolean;
  error?: string;
  clearedCount?: number;
};

function revalidateKeeperPaths(slug: string) {
  revalidatePath(`/league/${slug}/team`);
  revalidatePath(`/league/${slug}/activity`);
  revalidatePath(`/league/${slug}/settings`);
  revalidatePath(`/league/${slug}/settings/keepers`);
  revalidatePath(`/league/${slug}/players`);
}

export async function updateTeamKeepers(
  slug: string,
  keeperPlayerIds: string[],
  teamId?: string,
): Promise<KeepersActionResult> {
  const parsed = updateTeamKeepersSchema.safeParse({
    keeperPlayerIds,
    teamId,
  });
  if (!parsed.success) {
    return { success: false, error: "Invalid keeper selection." };
  }

  const uniqueIds = [...new Set(parsed.data.keeperPlayerIds)];
  const asCommissioner = Boolean(parsed.data.teamId);
  const context = await loadLeagueActionContext(slug, {
    requireMembership: true,
    requireTeam: !asCommissioner,
    includeCommissioner: asCommissioner,
    requireCommissioner: asCommissioner ? true : undefined,
    commissionerError: "Only the commissioner can set keepers for another team.",
  });
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { season, user } = context;
  if (season.leagueType !== "dynasty") {
    return {
      success: false,
      error: "Keepers are only available in dynasty leagues.",
    };
  }

  const dynasty = resolveDynastySettings(season.settings.dynasty);
  if (areKeepersLocked(dynasty)) {
    return {
      success: false,
      error: "Keepers are locked until the draft completes.",
    };
  }

  let targetTeamId = context.team?.id ?? null;
  let targetTeamName = context.team?.name ?? null;
  if (parsed.data.teamId) {
    const [row] = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(
        and(eq(teams.id, parsed.data.teamId), eq(teams.leagueSeasonId, season.id)),
      )
      .limit(1);
    if (!row) {
      return { success: false, error: "Team not found." };
    }
    targetTeamId = row.id;
    targetTeamName = row.name;
  }

  if (!targetTeamId || !targetTeamName) {
    return { success: false, error: "Team not found." };
  }

  const rostered = await db
    .select({
      playerId: rosterPlayers.playerId,
      slotPositionId: rosterPlayers.slotPositionId,
      isKeeper: rosterPlayers.isKeeper,
    })
    .from(rosterPlayers)
    .where(
      and(
        eq(rosterPlayers.teamId, targetTeamId),
        eq(rosterPlayers.status, "rostered"),
      ),
    );

  const rosteredById = new Map(
    rostered.map((row) => [row.playerId, row] as const),
  );
  for (const playerId of uniqueIds) {
    if (!rosteredById.has(playerId)) {
      return {
        success: false,
        error: asCommissioner
          ? "One or more selected players are not on that roster."
          : "One or more selected players are not on your roster.",
      };
    }
  }

  const selected = uniqueIds.map((playerId) => ({
    slotPositionId: rosteredById.get(playerId)!.slotPositionId,
  }));
  const validation = validateKeeperSelection(selected, dynasty);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }

  const selectedSet = new Set(uniqueIds);
  const currentlyKeepers = rostered
    .filter((row) => row.isKeeper)
    .map((row) => row.playerId);
  const sameSelection =
    currentlyKeepers.length === uniqueIds.length &&
    currentlyKeepers.every((id) => selectedSet.has(id));
  if (sameSelection) {
    return { success: true };
  }

  await db.transaction(async (tx) => {
    if (uniqueIds.length > 0) {
      await tx
        .update(rosterPlayers)
        .set({
          isKeeper: true,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(rosterPlayers.teamId, targetTeamId),
            eq(rosterPlayers.status, "rostered"),
            inArray(rosterPlayers.playerId, uniqueIds),
          ),
        );
    }

    await tx
      .update(rosterPlayers)
      .set({
        isKeeper: false,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(rosterPlayers.teamId, targetTeamId),
          eq(rosterPlayers.status, "rostered"),
          uniqueIds.length > 0
            ? notInArray(rosterPlayers.playerId, uniqueIds)
            : sql`true`,
        ),
      );
  });

  const summary = asCommissioner
    ? `Commissioner set ${validation.counting} keeper${validation.counting === 1 ? "" : "s"} for ${targetTeamName}`
    : `${targetTeamName} set ${validation.counting} keeper${validation.counting === 1 ? "" : "s"}`;

  await logLeagueActivity({
    leagueSeasonId: season.id,
    type: "keepers_set",
    summary,
    teamId: targetTeamId,
    actorUserId: user.id,
    metadata: {
      keeperCount: validation.counting,
      keeperPlayerIds: uniqueIds,
      teamName: targetTeamName,
      setByCommissioner: asCommissioner,
    },
  });

  revalidateKeeperPaths(slug);
  return { success: true };
}

export async function clearNonKeepers(
  slug: string,
): Promise<KeepersActionResult> {
  const context = await loadLeagueActionContext(slug, {
    requireMembership: true,
    requireCommissioner: true,
    commissionerError: "Only the commissioner can clear non-keepers.",
  });
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { season, user, league } = context;
  const result = await clearNonKeepersForSeason({
    leagueSeasonId: season.id,
    leaguePublicId: league.publicId,
    source: "commissioner",
    actorUserId: user.id,
  });
  if (!result.ok) {
    return { success: false, error: result.error };
  }
  return { success: true, clearedCount: result.clearedCount };
}
