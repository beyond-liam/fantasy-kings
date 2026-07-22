import { and, asc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { leagueSeasons, matchups, teams } from "@/db/schema";
import { db } from "@/lib/db";
import { ensureSeasonMatchupPublicIds } from "@/lib/leagues/ensure-public-ids";
import { isPublicIdFormat } from "@/lib/leagues/public-id";

export type LeagueMatchupRow = {
  id: string;
  /** Short URL segment under `/scores/[matchupId]`. */
  publicId: string;
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
  publicId: string;
  week: number;
  opponentTeamId: string;
  opponentName: string;
  opponentSlug: string;
  opponentLogoUrl: string | null;
  isHome: boolean;
};

const homeTeams = alias(teams, "home_teams");
const awayTeams = alias(teams, "away_teams");

const matchupSelect = {
  id: matchups.id,
  publicId: matchups.publicId,
  week: matchups.week,
  homeTeamId: matchups.homeTeamId,
  homeTeamName: homeTeams.name,
  homeTeamSlug: homeTeams.publicId,
  homeTeamLogoUrl: homeTeams.logoUrl,
  awayTeamId: matchups.awayTeamId,
  awayTeamName: awayTeams.name,
  awayTeamSlug: awayTeams.publicId,
  awayTeamLogoUrl: awayTeams.logoUrl,
} as const;

function mapMatchupRow<T extends {
  publicId: string | null;
  homeTeamSlug: string | null;
  awayTeamSlug: string | null;
}>(
  row: T,
): Omit<T, "publicId" | "homeTeamSlug" | "awayTeamSlug"> & {
  publicId: string;
  homeTeamSlug: string;
  awayTeamSlug: string;
} {
  return {
    ...row,
    publicId: row.publicId ?? "",
    homeTeamSlug: row.homeTeamSlug ?? "",
    awayTeamSlug: row.awayTeamSlug ?? "",
  };
}

/** All regular-season matchups for a league season, with team names. */
export async function getSeasonMatchups(
  leagueSeasonId: string,
): Promise<LeagueMatchupRow[]> {
  await ensureSeasonMatchupPublicIds(leagueSeasonId);

  const rows = await db
    .select(matchupSelect)
    .from(matchups)
    .innerJoin(homeTeams, eq(matchups.homeTeamId, homeTeams.id))
    .innerJoin(awayTeams, eq(matchups.awayTeamId, awayTeams.id))
    .where(eq(matchups.leagueSeasonId, leagueSeasonId))
    .orderBy(asc(matchups.week), asc(awayTeams.name));

  return rows.map(mapMatchupRow);
}

/** Matchups for a single fantasy week. */
export async function getWeekMatchups(
  leagueSeasonId: string,
  week: number,
): Promise<LeagueMatchupRow[]> {
  await ensureSeasonMatchupPublicIds(leagueSeasonId);

  const rows = await db
    .select(matchupSelect)
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

  return rows.map(mapMatchupRow);
}

type MatchupDetail = LeagueMatchupRow & {
  leagueSeasonId: string;
  leagueId: string;
  seasonYear: number;
};

/** One matchup by internal UUID (with team names + owning league). */
export async function getMatchupById(
  matchupId: string,
): Promise<MatchupDetail | null> {
  const [row] = await db
    .select({
      ...matchupSelect,
      leagueSeasonId: matchups.leagueSeasonId,
      leagueId: leagueSeasons.leagueId,
      seasonYear: leagueSeasons.seasonYear,
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

  return mapMatchupRow(row);
}

/**
 * Resolve a matchup from a URL key (6-char public id or legacy UUID),
 * scoped to a league.
 */
export async function getMatchupByKey(input: {
  leagueId: string;
  matchupKey: string;
}): Promise<MatchupDetail | null> {
  const key = input.matchupKey.trim();
  if (!key) {
    return null;
  }

  if (isPublicIdFormat(key)) {
    const [row] = await db
      .select({
        ...matchupSelect,
        leagueSeasonId: matchups.leagueSeasonId,
        leagueId: leagueSeasons.leagueId,
        seasonYear: leagueSeasons.seasonYear,
      })
      .from(matchups)
      .innerJoin(
        leagueSeasons,
        eq(matchups.leagueSeasonId, leagueSeasons.id),
      )
      .innerJoin(homeTeams, eq(matchups.homeTeamId, homeTeams.id))
      .innerJoin(awayTeams, eq(matchups.awayTeamId, awayTeams.id))
      .where(
        and(
          eq(leagueSeasons.leagueId, input.leagueId),
          eq(matchups.publicId, key),
        ),
      )
      .limit(1);

    if (!row) {
      return null;
    }

    return mapMatchupRow(row);
  }

  const byId = await getMatchupById(key);
  if (!byId || byId.leagueId !== input.leagueId) {
    return null;
  }

  if (!byId.publicId) {
    await ensureSeasonMatchupPublicIds(byId.leagueSeasonId);
    return getMatchupById(key);
  }

  return byId;
}

/** One team's full regular-season schedule (opponent + home/away). */
export async function getTeamSchedule(
  leagueSeasonId: string,
  teamId: string,
): Promise<TeamScheduleRow[]> {
  await ensureSeasonMatchupPublicIds(leagueSeasonId);

  const rows = await db
    .select(matchupSelect)
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
    const mapped = mapMatchupRow(row);
    const isHome = mapped.homeTeamId === teamId;
    return {
      id: mapped.id,
      publicId: mapped.publicId,
      week: mapped.week,
      isHome,
      opponentTeamId: isHome ? mapped.awayTeamId : mapped.homeTeamId,
      opponentName: isHome ? mapped.awayTeamName : mapped.homeTeamName,
      opponentSlug: isHome ? mapped.awayTeamSlug : mapped.homeTeamSlug,
      opponentLogoUrl: isHome ? mapped.awayTeamLogoUrl : mapped.homeTeamLogoUrl,
    };
  });
}
