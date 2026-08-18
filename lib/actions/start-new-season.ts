"use server";

import { revalidatePath } from "next/cache";

import { loadLeagueActionContext } from "@/lib/leagues/action-context";
import { executeSeasonRoll } from "@/lib/leagues/season-roll/execute";
import { getLeagueHomeData } from "@/lib/queries/leagues";

export type StartNewSeasonResult = {
  success: boolean;
  error?: string;
  seasonYear?: number;
};

export async function startNewSeason(
  slug: string,
): Promise<StartNewSeasonResult> {
  const ctx = await loadLeagueActionContext(slug, {
    requireCommissioner: true,
    commissionerError: "Only the commissioner can start a new season.",
  });
  if ("error" in ctx) {
    return { success: false, error: ctx.error };
  }

  if (ctx.season.leagueType !== "dynasty") {
    return {
      success: false,
      error: "Starting a new season is only available in dynasty leagues.",
    };
  }

  const data = await getLeagueHomeData(slug, ctx.user.id);
  if (!data?.isMember || !data.season) {
    return { success: false, error: "League season not found." };
  }

  const result = await executeSeasonRoll({
    league: ctx.league,
    season: data.season,
    standingsTeams: data.standingsTeams,
    actorUserId: ctx.user.id,
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  revalidatePath(`/league/${slug}`);
  revalidatePath(`/league/${slug}/settings`);
  revalidatePath(`/league/${slug}/settings/draft`);
  revalidatePath(`/league/${slug}/activity`);
  revalidatePath("/leagues");

  return { success: true, seasonYear: result.seasonYear };
}
