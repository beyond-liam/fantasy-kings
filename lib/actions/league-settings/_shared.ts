import { revalidatePath } from "next/cache";

import { eq } from "drizzle-orm";

import { leagueSeasons } from "@/db/schema";
import { requireSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isScheduleEditable } from "@/lib/leagues/season-calendar";
import { getLeagueBySlug, isLeagueCommissioner } from "@/lib/queries/leagues";
import { getNflState } from "@/lib/sleeper/api";

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldError?: string;
  fieldErrors?: Partial<Record<"name" | "logoUrl" | "divisions", string>>;
  redirectSlug?: string;
  teamIds?: string[];
  filledCount?: number;
};

export async function getCommissionerSeason(slug: string) {
  const user = await requireSessionUser();
  const league = await getLeagueBySlug(slug);

  if (!league) {
    return { error: "League not found." as const };
  }

  const isCommissioner = await isLeagueCommissioner(league.id, user.id);
  if (!isCommissioner) {
    return {
      error: "Only the commissioner can edit league settings." as const,
    };
  }

  const [season] = await db
    .select()
    .from(leagueSeasons)
    .where(eq(leagueSeasons.leagueId, league.id))
    .limit(1);

  if (!season) {
    return { error: "League season not found." as const };
  }

  return { season, league, user };
}

export async function assertScheduleStillEditable(seasonYear: number) {
  const nfl = await getNflState();
  if (!isScheduleEditable(seasonYear, nfl)) {
    return {
      success: false as const,
      error:
        "Schedule and playoff settings lock once NFL Week 1 of the season begins.",
    };
  }
  return { success: true as const, nfl };
}

export function revalidateSettingsPaths(slug: string) {
  revalidatePath(`/league/${slug}/settings`);
  revalidatePath(`/league/${slug}/settings/scoring`);
  revalidatePath(`/league/${slug}/settings/roster`);
  revalidatePath(`/league/${slug}/settings/lineup-locking`);
  revalidatePath(`/league/${slug}/settings/waivers`);
  revalidatePath(`/league/${slug}/settings/tiebreakers`);
  revalidatePath(`/league/${slug}/settings/transactions`);
  revalidatePath(`/league/${slug}/settings/league`);
  revalidatePath(`/league/${slug}/settings/draft`);
  revalidatePath(`/league/${slug}/settings/draft-order`);
  revalidatePath(`/league/${slug}/settings/waiver-order`);
  revalidatePath(`/league/${slug}/settings/lineups`);
  revalidatePath(`/league/${slug}/settings/league-size`);
  revalidatePath(`/league/${slug}/settings/realign-divisions`);
  revalidatePath(`/league/${slug}/settings/co-commissioners`);
  revalidatePath(`/league/${slug}/settings/schedule`);
  revalidatePath(`/league/${slug}/settings/playoffs`);
  revalidatePath(`/league/${slug}/draft`);
  revalidatePath(`/league/${slug}`);
  revalidatePath("/leagues");
}

export function fieldErrorsFromZod(
  issues: { path: PropertyKey[]; message: string }[],
): Partial<Record<"name" | "logoUrl" | "divisions", string>> {
  const fieldErrors: Partial<
    Record<"name" | "logoUrl" | "divisions", string>
  > = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key === "name" || key === "logoUrl" || key === "divisions") {
      fieldErrors[key] ??= issue.message;
    }
  }
  return fieldErrors;
}
