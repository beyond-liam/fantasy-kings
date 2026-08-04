import "server-only";

import {
  buildAllTimeTable,
  pickDivisionWinnersForSeason,
  type HofDivision,
  type HofTeamIdentity,
} from "@/lib/leagues/hall-of-fame";
import {
  buildChampionshipSeasonRow,
  buildRegularSeasonTitleRow,
  runnerUpTeamIdFromBracket,
  toDivisionTitleSeasons,
  type HofChampionshipSeason,
  type HofDivisionTitleSeason,
  type HofRegularSeasonTitle,
} from "@/lib/leagues/hof-title-history";
import { getFinalMatchupsForSeason } from "@/lib/leagues/matchups/finals";
import {
  bracketTeamsFromStandings,
  buildPlayoffBracket,
} from "@/lib/leagues/playoff-bracket";
import { hydratePlayoffBracket } from "@/lib/leagues/playoff-bracket-hydrate";
import {
  clampPlayoffTeamCount,
  resolvePlayoffSettings,
} from "@/lib/leagues/playoff-settings";
import { getPlayoffWeekRange } from "@/lib/leagues/season-calendar";
import { buildLeagueStandings } from "@/lib/leagues/standings-from-matchups";
import {
  standingsOwnerName,
  type LeagueStandingsMember,
} from "@/lib/leagues/standings";
import { getLeagueHomeData } from "@/lib/queries/leagues";
import { db } from "@/lib/db";
import { divisions, matchups } from "@/db/schema";
import { and, asc, eq, gte } from "drizzle-orm";

function hofTeamsFromStandings(
  standingsTeams: LeagueStandingsMember[],
): HofTeamIdentity[] {
  const rows: HofTeamIdentity[] = [];
  for (const team of standingsTeams) {
    if (!team.teamId) continue;
    rows.push({
      teamId: team.teamId,
      teamPublicId: team.teamPublicId ?? null,
      teamName: team.teamName ?? "Team",
      ownerName: standingsOwnerName(team, "Unclaimed"),
      logoUrl: team.logoUrl ?? null,
      claimed: Boolean(team.userId),
      divisionId: team.divisionId ?? null,
    });
  }
  return rows;
}

/**
 * Current-season title lists for HoF View All pages.
 * Multi-season archives come later.
 */
export async function loadHofTitleLists(input: {
  leagueSlug: string;
  userId: string;
}): Promise<{
  leagueSlug: string;
  multiDivision: boolean;
  divisions: HofDivision[];
  championships: HofChampionshipSeason[];
  regularSeasonTitles: HofRegularSeasonTitle[];
  divisionTitles: HofDivisionTitleSeason[];
} | null> {
  const data = await getLeagueHomeData(input.leagueSlug, input.userId);
  if (!data?.isMember || !data.season) return null;

  const { season, standingsTeams, members } = data;
  const teams = hofTeamsFromStandings(standingsTeams ?? []);
  const claimed = teams.filter((t) => t.claimed);

  const seasonDivisions = await db
    .select({
      id: divisions.id,
      name: divisions.name,
      sortOrder: divisions.sortOrder,
    })
    .from(divisions)
    .where(eq(divisions.leagueSeasonId, season.id))
    .orderBy(asc(divisions.sortOrder))
    .catch(() => [] as HofDivision[]);

  const multiDivision =
    season.divisionCount > 1 && seasonDivisions.length > 1;

  const allFinals = await getFinalMatchupsForSeason(season.id).catch(() => []);
  const regularFinals = allFinals.filter(
    (m) => m.week <= season.regularSeasonEndWeek,
  );
  const allTimeTable = buildAllTimeTable(claimed, regularFinals);
  const rsTitle = buildRegularSeasonTitleRow({
    seasonYear: season.seasonYear,
    allTimeTable,
  });
  const divisionTitles = multiDivision
    ? toDivisionTitleSeasons(
        pickDivisionWinnersForSeason({
          seasonYear: season.seasonYear,
          divisions: seasonDivisions,
          allTimeTable,
          teams: claimed,
        }),
      )
    : [];

  const playoffSettings = resolvePlayoffSettings(season.settings.playoffs);
  const playoffTeamCount = clampPlayoffTeamCount(
    season.playoffTeamCount,
    season.teamCount,
  );

  let championTeamId: string | null = null;
  let runnerUpTeamId: string | null = null;

  if (playoffSettings.enabled && playoffTeamCount > 0) {
    const standings = buildLeagueStandings(
      standingsTeams ?? [],
      {
        teamCount: season.teamCount ?? members.length,
        faabBudget: null,
      },
      regularFinals,
      season.settings.tiebreakers,
    );
    const seedRows = standings
      .filter((row) => row.claimed && row.rank != null)
      .map((row) => ({
        seed: row.rank!,
        teamId: row.teamId,
        teamPublicId: row.teamPublicId,
        teamName: row.teamName,
        logoUrl: row.logoUrl,
        claimed: row.claimed,
      }));
    const seedTeams = bracketTeamsFromStandings(seedRows, playoffTeamCount);
    let bracket = buildPlayoffBracket({
      teams: seedTeams,
      playoffTeamCount,
      championshipWeek: season.championshipWeek,
      twoWeekChampionship: playoffSettings.twoWeekChampionship,
      enabled: true,
    });
    const range = getPlayoffWeekRange(
      season.championshipWeek,
      playoffTeamCount,
      {
        enabled: true,
        twoWeekChampionship: playoffSettings.twoWeekChampionship,
      },
    );
    if (bracket && range) {
      const playoffRows = await db
        .select({
          week: matchups.week,
          homeTeamId: matchups.homeTeamId,
          awayTeamId: matchups.awayTeamId,
          homePts: matchups.homePts,
          awayPts: matchups.awayPts,
          status: matchups.status,
        })
        .from(matchups)
        .where(
          and(
            eq(matchups.leagueSeasonId, season.id),
            gte(matchups.week, range.startWeek),
          ),
        )
        .catch(() => []);
      if (playoffRows.length > 0) {
        bracket = hydratePlayoffBracket(bracket, playoffRows, seedTeams);
      }
    }
    championTeamId = bracket?.champion?.teamId ?? null;
    runnerUpTeamId = runnerUpTeamIdFromBracket(bracket);
  }

  const championship = buildChampionshipSeasonRow({
    seasonYear: season.seasonYear,
    teams: claimed,
    championTeamId,
    runnerUpTeamId,
  });

  return {
    leagueSlug: data.league.publicId,
    multiDivision,
    divisions: seasonDivisions,
    championships: championship.champion ? [championship] : [],
    regularSeasonTitles: rsTitle ? [rsTitle] : [],
    divisionTitles,
  };
}
