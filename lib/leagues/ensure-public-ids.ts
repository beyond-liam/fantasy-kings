import { and, eq, inArray, isNull, or } from "drizzle-orm";

import { leagues, matchups, players, teams } from "@/db/schema";
import { db } from "@/lib/db";
import { generatePublicId } from "@/lib/leagues/public-id";

/** Same connection as an open transaction — required with postgres `max: 1`. */
type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

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

export async function allocateUniquePlayerPublicId(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const publicId = generatePublicId();
    const [existing] = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.publicId, publicId))
      .limit(1);
    if (!existing) {
      return publicId;
    }
  }
  throw new Error("Could not allocate player public id");
}

/** Ensure one player has a public id; returns the id (existing or new). */
export async function ensurePlayerPublicId(playerId: string): Promise<string> {
  const [row] = await db
    .select({ publicId: players.publicId })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  if (row?.publicId) {
    return row.publicId;
  }

  const publicId = await allocateUniquePlayerPublicId();
  await db
    .update(players)
    .set({ publicId, updatedAt: new Date() })
    .where(eq(players.id, playerId));
  return publicId;
}

/** Backfill missing player public ids (idempotent). */
export async function ensurePlayerPublicIds() {
  const rows = await db
    .select({ id: players.id })
    .from(players)
    .where(or(isNull(players.publicId), eq(players.publicId, "")));

  for (const row of rows) {
    await ensurePlayerPublicId(row.id);
  }
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

/**
 * Allocate many unique matchup public ids for one season (schedule insert).
 * Pass `executor` when called inside a transaction — with `max: 1` the pool
 * deadlocks if this queries on a second connection while the tx holds the only one.
 */
export async function allocateMatchupPublicIds(
  leagueSeasonId: string,
  count: number,
  executor: DbExecutor = db,
): Promise<string[]> {
  if (count <= 0) {
    return [];
  }

  const candidates = new Set<string>();
  let attempts = 0;
  while (candidates.size < count) {
    candidates.add(generatePublicId());
    attempts += 1;
    if (attempts > count * 50) {
      throw new Error("Could not allocate matchup public ids");
    }
  }

  let ids = [...candidates];
  const existing = await executor
    .select({ publicId: matchups.publicId })
    .from(matchups)
    .where(
      and(
        eq(matchups.leagueSeasonId, leagueSeasonId),
        inArray(matchups.publicId, ids),
      ),
    );

  if (existing.length === 0) {
    return ids;
  }

  const taken = new Set(
    existing
      .map((row) => row.publicId)
      .filter((id): id is string => Boolean(id)),
  );
  ids = ids.filter((id) => !taken.has(id));

  attempts = 0;
  while (ids.length < count) {
    const publicId = generatePublicId();
    attempts += 1;
    if (attempts > count * 50) {
      throw new Error("Could not allocate matchup public ids");
    }
    if (taken.has(publicId) || ids.includes(publicId)) {
      continue;
    }
    const [hit] = await executor
      .select({ id: matchups.id })
      .from(matchups)
      .where(
        and(
          eq(matchups.leagueSeasonId, leagueSeasonId),
          eq(matchups.publicId, publicId),
        ),
      )
      .limit(1);
    if (hit) {
      taken.add(publicId);
      continue;
    }
    ids.push(publicId);
  }

  return ids;
}

/** One-shot backfill for all leagues/teams/matchups/players. */
export async function backfillAllPublicIds() {
  await ensureLeaguePublicIds();
  await ensurePlayerPublicIds();

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
