import { and, eq, isNull, or } from "drizzle-orm";

import { leagues, teams } from "@/db/schema";
import { db } from "@/lib/db";
import { generatePublicId } from "@/lib/leagues/public-id";

async function allocateUniqueLeaguePublicId(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const publicId = generatePublicId();
    const [existing] = await db
      .select({ id: leagues.id })
      .from(leagues)
      .where(eq(leagues.publicId, publicId))
      .limit(1);
    if (!existing) {
      return publicId;
    }
  }
  throw new Error("Could not allocate league public id");
}

async function allocateUniqueTeamPublicId(
  leagueSeasonId: string,
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const publicId = generatePublicId();
    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(
        and(
          eq(teams.leagueSeasonId, leagueSeasonId),
          eq(teams.publicId, publicId),
        ),
      )
      .limit(1);
    if (!existing) {
      return publicId;
    }
  }
  throw new Error("Could not allocate team public id");
}

/** Backfill missing league public ids (idempotent). */
export async function ensureLeaguePublicIds() {
  const rows = await db
    .select({ id: leagues.id })
    .from(leagues)
    .where(or(isNull(leagues.publicId), eq(leagues.publicId, "")));

  for (const row of rows) {
    const publicId = await allocateUniqueLeaguePublicId();
    await db
      .update(leagues)
      .set({ publicId })
      .where(eq(leagues.id, row.id));
  }
}

/** Backfill missing team public ids for a season (idempotent). */
export async function ensureSeasonTeamPublicIds(leagueSeasonId: string) {
  const rows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(
      and(
        eq(teams.leagueSeasonId, leagueSeasonId),
        or(isNull(teams.publicId), eq(teams.publicId, "")),
      ),
    );

  for (const row of rows) {
    const publicId = await allocateUniqueTeamPublicId(leagueSeasonId);
    await db
      .update(teams)
      .set({ publicId })
      .where(eq(teams.id, row.id));
  }
}

export async function nextLeaguePublicId(): Promise<string> {
  return allocateUniqueLeaguePublicId();
}

export async function nextTeamPublicId(
  leagueSeasonId: string,
): Promise<string> {
  return allocateUniqueTeamPublicId(leagueSeasonId);
}

/** One-shot backfill for all leagues/teams. */
export async function backfillAllPublicIds() {
  await ensureLeaguePublicIds();

  const seasonIds = await db
    .selectDistinct({ leagueSeasonId: teams.leagueSeasonId })
    .from(teams);

  for (const row of seasonIds) {
    await ensureSeasonTeamPublicIds(row.leagueSeasonId);
  }
}
