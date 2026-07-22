import "server-only";

import { eq, inArray } from "drizzle-orm";

import { teams } from "@/db/schema";
import { db } from "@/lib/db";

/** Map team id → owning user id (teams without owners omitted). */
export async function getTeamOwnerUserIds(teamIds: string[]) {
  const unique = [...new Set(teamIds.filter(Boolean))];
  if (unique.length === 0) {
    return new Map<string, string>();
  }

  const rows = await db
    .select({ id: teams.id, userId: teams.userId })
    .from(teams)
    .where(inArray(teams.id, unique));

  return new Map(
    rows
      .filter((row): row is { id: string; userId: string } => Boolean(row.userId))
      .map((row) => [row.id, row.userId]),
  );
}

/** All claimed-team owner user ids for a league season. */
export async function getSeasonOwnerUserIds(leagueSeasonId: string) {
  const rows = await db
    .select({ userId: teams.userId })
    .from(teams)
    .where(eq(teams.leagueSeasonId, leagueSeasonId));

  return [
    ...new Set(
      rows
        .map((row) => row.userId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}

export function uniqueUserIds(
  userIds: Array<string | null | undefined>,
  exclude: Iterable<string | null | undefined> = [],
) {
  const skip = new Set<string>();
  for (const id of exclude) {
    if (id) {
      skip.add(id);
    }
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of userIds) {
    if (!id || skip.has(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}
