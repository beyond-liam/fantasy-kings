"use server";

import { and, asc, eq } from "drizzle-orm";

import { divisions, leagues, leagueSeasons } from "@/db/schema";
import { db } from "@/lib/db";
import {
  leagueIdentityFormSchema,
  type LeagueIdentityFormValues,
} from "@/lib/leagues/league-identity";
import { slugifyLeagueName } from "@/lib/leagues/utils";
import { getLeagueBySlug } from "@/lib/queries/leagues";

import {
  fieldErrorsFromZod,
  getCommissionerSeason,
  revalidateSettingsPaths,
  type ActionResult,
} from "./_shared";

async function generateUniqueSlug(baseSlug: string, excludeLeagueId: string) {
  const slug = baseSlug || "league";
  let suffix = 0;

  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const existing = await getLeagueBySlug(candidate);
    if (!existing || existing.id === excludeLeagueId) {
      return candidate;
    }
    suffix += 1;
  }
}

export async function updateLeagueIdentity(
  slug: string,
  values: LeagueIdentityFormValues,
): Promise<ActionResult> {
  const parsed = leagueIdentityFormSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid league settings.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season, league } = result;
  const next = parsed.data;

  const seasonDivisions = await db
    .select({ id: divisions.id })
    .from(divisions)
    .where(eq(divisions.leagueSeasonId, season.id))
    .orderBy(asc(divisions.sortOrder));

  const seasonDivisionIds = new Set(seasonDivisions.map((row) => row.id));
  if (
    next.divisions.length !== seasonDivisions.length ||
    next.divisions.some((division) => !seasonDivisionIds.has(division.id))
  ) {
    return {
      success: false,
      error: "Division list is out of date. Refresh and try again.",
      fieldErrors: { divisions: "Division list is out of date." },
    };
  }

  const nextSlug = await generateUniqueSlug(
    slugifyLeagueName(next.name),
    league.id,
  );

  const nextLogoUrl =
    next.logoMode === "remove"
      ? null
      : next.logoMode === "url" || next.logoMode === "upload"
        ? next.logoUrl.trim()
        : (season.settings.logoUrl ?? null);

  await db.transaction(async (tx) => {
    await tx
      .update(leagues)
      .set({
        name: next.name.trim(),
        slug: nextSlug,
      })
      .where(eq(leagues.id, league.id));

    await tx
      .update(leagueSeasons)
      .set({
        settings: {
          ...season.settings,
          logoUrl: nextLogoUrl,
        },
      })
      .where(eq(leagueSeasons.id, season.id));

    for (const division of next.divisions) {
      await tx
        .update(divisions)
        .set({ name: division.name.trim() })
        .where(
          and(
            eq(divisions.id, division.id),
            eq(divisions.leagueSeasonId, season.id),
          ),
        );
    }
  });

  revalidateSettingsPaths(slug);

  return { success: true, redirectSlug: league.publicId };
}
