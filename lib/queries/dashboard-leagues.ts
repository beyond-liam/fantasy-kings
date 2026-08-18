import "server-only";

import { eq, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cache } from "react";

import { matchups, teams } from "@/db/schema";
import { db } from "@/lib/db";
import {
  pickDashboardMatchupHighlight,
  type DashboardMatchupHighlight,
  type DashboardMatchupRow,
} from "@/lib/leagues/dashboard-matchup";
import { getGameWeekCloseState } from "@/lib/nfl/current-week-board";
import {
  getUserLeagues,
  type UserLeagueListItem,
} from "@/lib/queries/leagues";

export type DashboardLeagueCard = UserLeagueListItem & {
  matchup: DashboardMatchupHighlight | null;
};

const homeTeams = alias(teams, "home_teams");
const awayTeams = alias(teams, "away_teams");

export const getDashboardLeagues = cache(
  async (userId: string): Promise<DashboardLeagueCard[]> => {
    const leagues = await getUserLeagues(userId);
    const teamIds = leagues
      .map((league) => league.teamId)
      .filter((id): id is string => Boolean(id));

    if (teamIds.length === 0) {
      return leagues.map((league) => ({ ...league, matchup: null }));
    }

    const [close, rows] = await Promise.all([
      getGameWeekCloseState().catch(() => null),
      db
        .select({
          week: matchups.week,
          status: matchups.status,
          homeTeamId: matchups.homeTeamId,
          awayTeamId: matchups.awayTeamId,
          homeTeamName: homeTeams.name,
          awayTeamName: awayTeams.name,
          homePts: matchups.homePts,
          awayPts: matchups.awayPts,
        })
        .from(matchups)
        .innerJoin(homeTeams, eq(matchups.homeTeamId, homeTeams.id))
        .innerJoin(awayTeams, eq(matchups.awayTeamId, awayTeams.id))
        .where(
          or(
            inArray(matchups.homeTeamId, teamIds),
            inArray(matchups.awayTeamId, teamIds),
          ),
        )
        .catch(() => [] as DashboardMatchupRow[]),
    ]);

    const currentWeek = close?.fantasyWeek ?? null;

    return leagues.map((league) => ({
      ...league,
      matchup: league.teamId
        ? pickDashboardMatchupHighlight(league.teamId, rows, currentWeek)
        : null,
    }));
  },
);
