import { and, asc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { leagueSeasons, matchups, teams } from "@/db/schema";
import { db } from "@/lib/db";

export type LeagueMatchupRow = {
  id: string;
  week: number;
  homeTeamId: string;
  homeTeamName: string;
  homeTeamSlug: string;
  homeTeamLogoUrl: string | null;
  awayTeamId: string;
  awayTeamName: string;
  awayTeamSlug: string;
  awayTeamLogoUrl: string | null;
};

export type TeamScheduleRow = {
  id: string;
  week: number;
  opponentTeamId: string;
  opponentName: string;
  opponentSlug: string;
  opponentLogoUrl: string | null;
  isHome: boolean;
};

const homeTeams = alias(teams, "home_teams");
const awayTeams = alias(teams, "away_teams");

/** All regular-season matchups for a league season, with team names. */
export async function getSeasonMatchups(
  leagueSeasonId: string,
): Promise<LeagueMatchupRow[]> {
  const rows = await db
    .select({
      id: matchups.id,
      week: matchups.week,
      homeTeamId: matchups.homeTeamId,
      homeTeamName: homeTeams.name,
      homeTeamSlug: homeTeams.publicId,
      homeTeamLogoUrl: homeTeams.logoUrl,
      awayTeamId: matchups.awayTeamId,
      awayTeamName: awayTeams.name,
      awayTeamSlug: awayTeams.publicId,
      awayTeamLogoUrl: awayTeams.logoUrl,
    })
    .from(matchups)
    .innerJoin(homeTeams, eq(matchups.homeTeamId, homeTeams.id))
    .innerJoin(awayTeams, eq(matchups.awayTeamId, awayTeams.id))
    .where(eq(matchups.leagueSeasonId, leagueSeasonId))
    .orderBy(asc(matchups.week), asc(awayTeams.name));

  return rows.map((row) => ({
    ...row,
    homeTeamSlug: row.homeTeamSlug ?? "",
    awayTeamSlug: row.awayTeamSlug ?? "",
  }));
}

/** Matchups for a single fantasy week. */
export async function getWeekMatchups(
  leagueSeasonId: string,
  week: number,
): Promise<LeagueMatchupRow[]> {
  const rows = await db
    .select({
      id: matchups.id,
      week: matchups.week,
      homeTeamId: matchups.homeTeamId,
      homeTeamName: homeTeams.name,
      homeTeamSlug: homeTeams.publicId,
      homeTeamLogoUrl: homeTeams.logoUrl,
      awayTeamId: matchups.awayTeamId,
      awayTeamName: awayTeams.name,
      awayTeamSlug: awayTeams.publicId,
      awayTeamLogoUrl: awayTeams.logoUrl,
    })
    .from(matchups)
    .innerJoin(homeTeams, eq(matchups.homeTeamId, homeTeams.id))
    .innerJoin(awayTeams, eq(matchups.awayTeamId, awayTeams.id))
    .where(
      and(
        eq(matchups.leagueSeasonId, leagueSeasonId),
        eq(matchups.week, week),
      ),
    )
    .orderBy(asc(awayTeams.name));

  return rows.map((row) => ({
    ...row,
    homeTeamSlug: row.homeTeamSlug ?? "",
    awayTeamSlug: row.awayTeamSlug ?? "",
  }));
}

/** One matchup by id (with team names + owning league). */
export async function getMatchupById(matchupId: string): Promise<
  | (LeagueMatchupRow & {
      leagueSeasonId: string;
      leagueId: string;
      seasonYear: number;
    })
  | null
> {
  const [row] = await db
    .select({
      id: matchups.id,
      week: matchups.week,
      leagueSeasonId: matchups.leagueSeasonId,
      leagueId: leagueSeasons.leagueId,
      seasonYear: leagueSeasons.seasonYear,
      homeTeamId: matchups.homeTeamId,
      homeTeamName: homeTeams.name,
      homeTeamSlug: homeTeams.publicId,
      homeTeamLogoUrl: homeTeams.logoUrl,
      awayTeamId: matchups.awayTeamId,
      awayTeamName: awayTeams.name,
      awayTeamSlug: awayTeams.publicId,
      awayTeamLogoUrl: awayTeams.logoUrl,
    })
    .from(matchups)
    .innerJoin(
      leagueSeasons,
      eq(matchups.leagueSeasonId, leagueSeasons.id),
    )
    .innerJoin(homeTeams, eq(matchups.homeTeamId, homeTeams.id))
    .innerJoin(awayTeams, eq(matchups.awayTeamId, awayTeams.id))
    .where(eq(matchups.id, matchupId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    ...row,
    homeTeamSlug: row.homeTeamSlug ?? "",
    awayTeamSlug: row.awayTeamSlug ?? "",
  };
}

/** One team's full regular-season schedule (opponent + home/away). */
export async function getTeamSchedule(
  leagueSeasonId: string,
  teamId: string,
): Promise<TeamScheduleRow[]> {
  const rows = await db
    .select({
      id: matchups.id,
      week: matchups.week,
      homeTeamId: matchups.homeTeamId,
      homeTeamName: homeTeams.name,
      homeTeamSlug: homeTeams.publicId,
      homeTeamLogoUrl: homeTeams.logoUrl,
      awayTeamId: matchups.awayTeamId,
      awayTeamName: awayTeams.name,
      awayTeamSlug: awayTeams.publicId,
      awayTeamLogoUrl: awayTeams.logoUrl,
    })
    .from(matchups)
    .innerJoin(homeTeams, eq(matchups.homeTeamId, homeTeams.id))
    .innerJoin(awayTeams, eq(matchups.awayTeamId, awayTeams.id))
    .where(
      and(
        eq(matchups.leagueSeasonId, leagueSeasonId),
        or(eq(matchups.homeTeamId, teamId), eq(matchups.awayTeamId, teamId)),
      ),
    )
    .orderBy(asc(matchups.week));

  return rows.map((row) => {
    const isHome = row.homeTeamId === teamId;
    return {
      id: row.id,
      week: row.week,
      isHome,
      opponentTeamId: isHome ? row.awayTeamId : row.homeTeamId,
      opponentName: isHome ? row.awayTeamName : row.homeTeamName,
      opponentSlug: (isHome ? row.awayTeamSlug : row.homeTeamSlug) ?? "",
      opponentLogoUrl: isHome ? row.awayTeamLogoUrl : row.homeTeamLogoUrl,
    };
  });
}
