import { and, eq, isNull, or } from "drizzle-orm";

import { leagues, matchups, teams } from "@/db/schema";
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

async function allocateUniqueMatchupPublicId(
  leagueSeasonId: string,
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const publicId = generatePublicId();
    const [existing] = await db
      .select({ id: matchups.id })
      .from(matchups)
      .where(
        and(
          eq(matchups.leagueSeasonId, leagueSeasonId),
          eq(matchups.publicId, publicId),
        ),
      )
      .limit(1);
    if (!existing) {
      return publicId;
    }
  }
  throw new Error("Could not allocate matchup public id");
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

/** Backfill missing matchup public ids for a season (idempotent). */
export async function ensureSeasonMatchupPublicIds(leagueSeasonId: string) {
  const rows = await db
    .select({ id: matchups.id })
    .from(matchups)
    .where(
      and(
        eq(matchups.leagueSeasonId, leagueSeasonId),
        or(isNull(matchups.publicId), eq(matchups.publicId, "")),
      ),
    );

  for (const row of rows) {
    const publicId = await allocateUniqueMatchupPublicId(leagueSeasonId);
    await db
      .update(matchups)
      .set({ publicId })
      .where(eq(matchups.id, row.id));
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

export async function nextMatchupPublicId(
  leagueSeasonId: string,
): Promise<string> {
  return allocateUniqueMatchupPublicId(leagueSeasonId);
}

/** Allocate many unique matchup public ids for one season (schedule insert). */
export async function allocateMatchupPublicIds(
  leagueSeasonId: string,
  count: number,
): Promise<string[]> {
  const ids: string[] = [];
  const used = new Set<string>();
  while (ids.length < count) {
    const publicId = generatePublicId();
    if (used.has(publicId)) continue;
    const [existing] = await db
      .select({ id: matchups.id })
      .from(matchups)
      .where(
        and(
          eq(matchups.leagueSeasonId, leagueSeasonId),
          eq(matchups.publicId, publicId),
        ),
      )
      .limit(1);
    if (existing) continue;
    used.add(publicId);
    ids.push(publicId);
  }
  return ids;
}

/** One-shot backfill for all leagues/teams/matchups. */
export async function backfillAllPublicIds() {
  await ensureLeaguePublicIds();

  const seasonIds = await db
    .selectDistinct({ leagueSeasonId: teams.leagueSeasonId })
    .from(teams);

  for (const row of seasonIds) {
    await ensureSeasonTeamPublicIds(row.leagueSeasonId);
  }

  const matchupSeasons = await db
    .selectDistinct({ leagueSeasonId: matchups.leagueSeasonId })
    .from(matchups);

  for (const row of matchupSeasons) {
    await ensureSeasonMatchupPublicIds(row.leagueSeasonId);
  }
}
