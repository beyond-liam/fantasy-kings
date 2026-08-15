"use server";

import { revalidatePath } from "next/cache";

import { loadLeagueActionContext } from "@/lib/leagues/action-context";
import { markLeagueActivitySeen as persistActivitySeen } from "@/lib/queries/activity";

export async function markLeagueActivitySeen(
  slug: string,
): Promise<{ success: boolean }> {
  const ctx = await loadLeagueActionContext(slug, { requireMembership: true });
  if ("error" in ctx) {
    return { success: false };
  }

  await persistActivitySeen({
    leagueId: ctx.league.id,
    userId: ctx.user.id,
  });
  revalidatePath(`/league/${slug}`, "layout");
  return { success: true };
}
