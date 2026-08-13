"use server";

import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { rosterPlayers } from "@/db/schema";
import { db } from "@/lib/db";
import { logLeagueActivity } from "@/lib/leagues/activity-log";
import { loadLeagueMemberTeamContext } from "@/lib/leagues/action-context";
import {
  resolveDynastySettings,
  validateKeeperSelection,
} from "@/lib/leagues/dynasty-settings";

const updateTeamKeepersSchema = z.object({
  keeperPlayerIds: z.array(z.string().uuid()),
});

export type KeepersActionResult = {
  success: boolean;
  error?: string;
};

function revalidateKeeperPaths(slug: string) {
  revalidatePath(`/league/${slug}/team`);
  revalidatePath(`/league/${slug}/activity`);
}

export async function updateTeamKeepers(
  slug: string,
  keeperPlayerIds: string[],
): Promise<KeepersActionResult> {
  const parsed = updateTeamKeepersSchema.safeParse({ keeperPlayerIds });
  if (!parsed.success) {
    return { success: false, error: "Invalid keeper selection." };
  }

  const uniqueIds = [...new Set(parsed.data.keeperPlayerIds)];
  const context = await loadLeagueMemberTeamContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { season, team, user } = context;
  if (season.leagueType !== "dynasty") {
    return {
      success: false,
      error: "Keepers are only available in dynasty leagues.",
    };
  }

  const dynasty = resolveDynastySettings(season.settings.dynasty);
  const rostered = await db
    .select({
      playerId: rosterPlayers.playerId,
      slotPositionId: rosterPlayers.slotPositionId,
      isKeeper: rosterPlayers.isKeeper,
    })
    .from(rosterPlayers)
    .where(
      and(
        eq(rosterPlayers.teamId, team.id),
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
        error: "One or more selected players are not on your roster.",
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
  const currentlyKeepers = rostered.filter((row) => row.isKeeper).map((r) => r.playerId);
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
            eq(rosterPlayers.teamId, team.id),
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
          eq(rosterPlayers.teamId, team.id),
          eq(rosterPlayers.status, "rostered"),
          uniqueIds.length > 0
            ? notInArray(rosterPlayers.playerId, uniqueIds)
            : sql`true`,
        ),
      );
  });

  await logLeagueActivity({
    leagueSeasonId: season.id,
    type: "keepers_set",
    summary: `${team.name} set ${validation.counting} keeper${validation.counting === 1 ? "" : "s"}`,
    teamId: team.id,
    actorUserId: user.id,
    metadata: {
      keeperCount: validation.counting,
      keeperPlayerIds: uniqueIds,
    },
  });

  revalidateKeeperPaths(slug);
  return { success: true };
}
