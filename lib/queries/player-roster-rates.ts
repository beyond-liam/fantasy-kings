import { and, count, countDistinct, eq, inArray, sql } from "drizzle-orm";
import { cache } from "react";

import { leagueSeasons, rosterPlayers, teams } from "@/db/schema";
import { db } from "@/lib/db";

export type PlayerRosterRates = {
  /** % of draft/active leagues where the player is rostered (owned). */
  ownedPct: number | null;
  /** % of those owned spots that are in a starting slot. */
  startPct: number | null;
};

const COUNTED_SEASON_STATUSES = ["draft", "active"] as const;

function toPct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) {
    return null;
  }
  return (numerator / denominator) * 100;
}

async function countEligibleLeagues() {
  const [row] = await db
    .select({ value: count() })
    .from(leagueSeasons)
    .where(inArray(leagueSeasons.status, [...COUNTED_SEASON_STATUSES]));

  return Number(row?.value ?? 0);
}

/**
 * League-wide ownership / start rates.
 * OWN = leagues where rostered / all draft|active leagues
 *     (= reverse of "% of leagues available as a free agent").
 * START = starting slots among those owned roster spots (BN/IR/TAXI/null excluded).
 */
export const getPlayerRosterRatesMap = cache(
  async (playerIds: string[]): Promise<Map<string, PlayerRosterRates>> => {
    const map = new Map<string, PlayerRosterRates>();
    if (playerIds.length === 0) {
      return map;
    }

    const uniqueIds = [...new Set(playerIds)];
    const leagueTotal = await countEligibleLeagues();

    const rows = await db
      .select({
        playerId: rosterPlayers.playerId,
        ownedLeagues: countDistinct(leagueSeasons.id),
        ownedSpots: sql<number>`count(*)::int`.mapWith(Number),
        starting: sql<number>`count(*) filter (
          where ${rosterPlayers.slotPositionId} is not null
            and ${rosterPlayers.slotPositionId} not in ('BN', 'IR', 'TAXI')
        )::int`.mapWith(Number),
      })
      .from(rosterPlayers)
      .innerJoin(teams, eq(rosterPlayers.teamId, teams.id))
      .innerJoin(leagueSeasons, eq(teams.leagueSeasonId, leagueSeasons.id))
      .where(
        and(
          eq(rosterPlayers.status, "rostered"),
          inArray(rosterPlayers.playerId, uniqueIds),
          inArray(leagueSeasons.status, [...COUNTED_SEASON_STATUSES]),
        ),
      )
      .groupBy(rosterPlayers.playerId);

    for (const id of uniqueIds) {
      map.set(id, { ownedPct: toPct(0, leagueTotal), startPct: null });
    }

    for (const row of rows) {
      const ownedLeagues = Number(row.ownedLeagues);
      const ownedSpots = Number(row.ownedSpots);
      const starting = Number(row.starting);
      map.set(row.playerId, {
        ownedPct: toPct(ownedLeagues, leagueTotal),
        startPct: toPct(starting, ownedSpots),
      });
    }

    return map;
  },
);
