import { asc, eq } from "drizzle-orm";

import { teams } from "@/db/schema";
import { db } from "@/lib/db";
import { allocateUniqueTeamSlug } from "@/lib/leagues/utils";

/** Backfill missing or empty team slugs for a season (idempotent). */
export async function ensureSeasonTeamSlugs(leagueSeasonId: string) {
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
    })
    .from(teams)
    .where(eq(teams.leagueSeasonId, leagueSeasonId))
    .orderBy(asc(teams.createdAt));

  const taken = new Set(
    rows
      .map((row) => row.slug?.trim())
      .filter((slug): slug is string => Boolean(slug)),
  );

  for (const row of rows) {
    if (row.slug?.trim()) {
      continue;
    }
    const slug = allocateUniqueTeamSlug(row.name, taken, row.id);
    taken.add(slug);
    await db.update(teams).set({ slug }).where(eq(teams.id, row.id));
  }
}

export async function nextTeamSlugForSeason(
  leagueSeasonId: string,
  name: string,
  fallbackId?: string,
): Promise<string> {
  const rows = await db
    .select({ slug: teams.slug })
    .from(teams)
    .where(eq(teams.leagueSeasonId, leagueSeasonId));
  const taken = new Set(
    rows
      .map((row) => row.slug)
      .filter((slug): slug is string => Boolean(slug)),
  );
  return allocateUniqueTeamSlug(name, taken, fallbackId);
}
