import { and, eq, inArray } from "drizzle-orm";
import { cache } from "react";

import { matchups } from "@/db/schema";
import { db } from "@/lib/db";

/** Final Matchup rows for one League Season (standings, HOF, Team Stats). */
export const getFinalMatchupsForSeason = cache(
  async (leagueSeasonId: string) => {
    return db
      .select({
        id: matchups.id,
        week: matchups.week,
        homeTeamId: matchups.homeTeamId,
        awayTeamId: matchups.awayTeamId,
        homePts: matchups.homePts,
        awayPts: matchups.awayPts,
      })
      .from(matchups)
      .where(
        and(
          eq(matchups.leagueSeasonId, leagueSeasonId),
          eq(matchups.status, "final"),
        ),
      )
      .orderBy(matchups.week);
  },
);

export type FinalMatchupRow = Awaited<
  ReturnType<typeof getFinalMatchupsForSeason>
>[number];

/** Batch finals for many seasons (leagues list). */
export async function getFinalMatchupsForSeasons(
  leagueSeasonIds: string[],
): Promise<Map<string, FinalMatchupRow[]>> {
  const map = new Map<string, FinalMatchupRow[]>();
  if (leagueSeasonIds.length === 0) {
    return map;
  }

  for (const id of leagueSeasonIds) {
    map.set(id, []);
  }

  const rows = await db
    .select({
      leagueSeasonId: matchups.leagueSeasonId,
      id: matchups.id,
      week: matchups.week,
      homeTeamId: matchups.homeTeamId,
      awayTeamId: matchups.awayTeamId,
      homePts: matchups.homePts,
      awayPts: matchups.awayPts,
    })
    .from(matchups)
    .where(
      and(
        inArray(matchups.leagueSeasonId, leagueSeasonIds),
        eq(matchups.status, "final"),
      ),
    )
    .orderBy(matchups.week);

  for (const row of rows) {
    const list = map.get(row.leagueSeasonId) ?? [];
    list.push({
      id: row.id,
      week: row.week,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      homePts: row.homePts,
      awayPts: row.awayPts,
    });
    map.set(row.leagueSeasonId, list);
  }

  return map;
}

/** Records map for matchup board enrichment. */
export function recordsFromFinalMatchups(
  finals: Array<{
    homeTeamId: string;
    awayTeamId: string;
    homePts: number | null;
    awayPts: number | null;
  }>,
): Map<string, { wins: number; losses: number; ties: number }> {
  const map = new Map<string, { wins: number; losses: number; ties: number }>();

  const bump = (teamId: string, field: "wins" | "losses" | "ties") => {
    const row = map.get(teamId) ?? { wins: 0, losses: 0, ties: 0 };
    row[field] += 1;
    map.set(teamId, row);
  };

  for (const matchup of finals) {
    if (matchup.homePts == null || matchup.awayPts == null) continue;
    const diff = matchup.homePts - matchup.awayPts;
    if (Math.abs(diff) <= 0.05) {
      bump(matchup.homeTeamId, "ties");
      bump(matchup.awayTeamId, "ties");
    } else if (diff > 0) {
      bump(matchup.homeTeamId, "wins");
      bump(matchup.awayTeamId, "losses");
    } else {
      bump(matchup.awayTeamId, "wins");
      bump(matchup.homeTeamId, "losses");
    }
  }

  return map;
}
