import "server-only";

import {
  latestScoredWeek,
  pickWeeklyRoast,
  weeklyResultsFromFinals,
  type OverviewWeeklyRoast,
} from "@/lib/leagues/league-overview";
import { getLeagueRollupMatchups } from "@/lib/leagues/matchups/finals";
import type { ScheduleSettings } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import { teamWeekStats } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export type OverviewWeeklyRoastTeam = {
  teamId: string;
  teamPublicId: string | null;
  teamName: string;
  ownerName: string;
  ownerUserId?: string | null;
  logoUrl: string | null;
};

/**
 * Latest finalized week's roast plaques, or null before any scored week.
 */
export async function loadOverviewWeeklyRoast(input: {
  leagueSeasonId: string;
  regularSeasonEndWeek: number;
  schedule?: ScheduleSettings | null;
  teams: OverviewWeeklyRoastTeam[];
}): Promise<OverviewWeeklyRoast | null> {
  const claimed = input.teams.filter((team) => Boolean(team.teamId));
  if (claimed.length === 0) return null;

  const finals = await getLeagueRollupMatchups(
    input.leagueSeasonId,
    input.schedule,
  ).catch(() => []);
  const regularFinals = finals.filter(
    (m) => m.week <= input.regularSeasonEndWeek,
  );
  const week = latestScoredWeek(regularFinals);
  if (week == null) return null;

  const results = weeklyResultsFromFinals(regularFinals, week);
  if (results.length === 0) return null;

  const opfRows = await db
    .select({
      teamId: teamWeekStats.teamId,
      pointsFor: teamWeekStats.pointsFor,
      optimumPointsFor: teamWeekStats.optimumPointsFor,
    })
    .from(teamWeekStats)
    .where(
      and(
        eq(teamWeekStats.leagueSeasonId, input.leagueSeasonId),
        eq(teamWeekStats.week, week),
      ),
    )
    .catch(() => []);

  const benchLeftByTeamId = new Map<string, number>();
  for (const row of opfRows) {
    if (row.pointsFor == null || row.optimumPointsFor == null) continue;
    const left = Math.max(0, row.optimumPointsFor - row.pointsFor);
    benchLeftByTeamId.set(row.teamId, Math.round(left * 10) / 10);
  }

  return pickWeeklyRoast({
    week,
    teams: claimed,
    results,
    benchLeftByTeamId,
  });
}
