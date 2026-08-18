import "server-only";

import {
  buildAllTimeTable,
  countDivisionTitlesByTeam,
  countLuckyWinsByTeam,
  hasCompletedRegularSeason,
  pickDivisionWinnersForSeason,
  pickMostRegularSeasonWins,
  pickTopCount,
  pickWinningScoreExtremes,
  type HofDivision,
  type HofTeamIdentity,
  type LeagueHallOfFameData,
} from "@/lib/leagues/hall-of-fame";
import { getLeagueRollupMatchups } from "@/lib/leagues/matchups/finals";
import type { ScheduleSettings } from "@/db/schema/league-seasons";
import type { ScoringPreset } from "@/lib/leagues/scoring";
import { loadHofLateGameSwingCounts } from "@/lib/queries/hof-late-game-swings";
import { db } from "@/lib/db";
import { divisions, leagueSeasons, teamWeekStats } from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";

export function emptyLeagueHallOfFame(): LeagueHallOfFameData {
  return {
    mostTitles: null,
    middleHonor: null,
    middleHonorKind: "regular_season_titles",
    mostRegularSeasonWins: null,
    allTimeTable: [],
    chokeArtist: null,
    fergieTime: null,
    luckiest: null,
    highestWinningScore: null,
    lowestWinningScore: null,
  };
}

async function loadSeasonDivisions(
  leagueSeasonId: string,
): Promise<HofDivision[]> {
  return db
    .select({
      id: divisions.id,
      name: divisions.name,
      sortOrder: divisions.sortOrder,
    })
    .from(divisions)
    .where(eq(divisions.leagueSeasonId, leagueSeasonId))
    .orderBy(asc(divisions.sortOrder))
    .catch(() => []);
}

/**
 * Hall of Fame snapshot for the current season (career continuity across
 * seasons comes later).
 */
export async function loadLeagueHallOfFame(input: {
  leagueSeasonId: string;
  seasonYear: number;
  teams: HofTeamIdentity[];
  divisionCount: number;
  regularSeasonEndWeek: number;
  schedule?: ScheduleSettings | null;
  /** Championship team id if the current bracket is crowned. */
  championTeamId?: string | null;
}): Promise<LeagueHallOfFameData> {
  const claimed = input.teams.filter((t) => t.claimed);
  if (claimed.length === 0) {
    return emptyLeagueHallOfFame();
  }

  const finals = await getLeagueRollupMatchups(
    input.leagueSeasonId,
    input.schedule,
  ).catch(() => []);
  const regularFinals = finals.filter(
    (m) => m.week <= input.regularSeasonEndWeek,
  );

  const allTimeTable = buildAllTimeTable(claimed, regularFinals);
  const mostRegularSeasonWins = pickMostRegularSeasonWins(allTimeTable);
  const { highest, lowest } = pickWinningScoreExtremes(claimed, finals);

  // Lucky wins: opponent OPF would have beaten your actual score.
  const weeks = [...new Set(regularFinals.map((m) => m.week))];
  const opfRows =
    weeks.length === 0
      ? []
      : await db
          .select({
            teamId: teamWeekStats.teamId,
            week: teamWeekStats.week,
            optimumPointsFor: teamWeekStats.optimumPointsFor,
          })
          .from(teamWeekStats)
          .where(
            and(
              eq(teamWeekStats.leagueSeasonId, input.leagueSeasonId),
              inArray(teamWeekStats.week, weeks),
            ),
          )
          .catch(() => []);

  const opfByTeamWeek = new Map<string, number>();
  for (const row of opfRows) {
    if (row.optimumPointsFor == null) continue;
    opfByTeamWeek.set(`${row.teamId}:${row.week}`, row.optimumPointsFor);
  }

  const luckyFinals = regularFinals.map((m) => ({
    ...m,
    homeOptimum: opfByTeamWeek.get(`${m.homeTeamId}:${m.week}`) ?? null,
    awayOptimum: opfByTeamWeek.get(`${m.awayTeamId}:${m.week}`) ?? null,
  }));
  const luckiest = pickTopCount(
    claimed,
    countLuckyWinsByTeam(luckyFinals),
  );

  let mostTitles: LeagueHallOfFameData["mostTitles"] = null;
  if (input.championTeamId) {
    const champ = claimed.find((t) => t.teamId === input.championTeamId);
    if (champ) {
      mostTitles = {
        teamId: champ.teamId,
        teamPublicId: champ.teamPublicId,
        teamName: champ.teamName,
        ownerName: champ.ownerName,
        logoUrl: champ.logoUrl,
        value: 1,
      };
    }
  }

  const seasonDivisions = await loadSeasonDivisions(input.leagueSeasonId);
  const multiDivision =
    input.divisionCount > 1 && seasonDivisions.length > 1;
  let middleHonor: LeagueHallOfFameData["middleHonor"] = null;
  const middleHonorKind: LeagueHallOfFameData["middleHonorKind"] =
    multiDivision ? "division_titles" : "regular_season_titles";
  const regularSeasonComplete = hasCompletedRegularSeason(
    regularFinals,
    input.regularSeasonEndWeek,
  );

  if (regularSeasonComplete && multiDivision) {
    const winners = pickDivisionWinnersForSeason({
      seasonYear: input.seasonYear,
      divisions: seasonDivisions,
      allTimeTable,
      teams: claimed,
    });
    middleHonor = pickTopCount(
      claimed,
      countDivisionTitlesByTeam(winners),
    );
  } else if (
    regularSeasonComplete &&
    allTimeTable[0] &&
    allTimeTable[0].wins > 0
  ) {
    const top = allTimeTable[0];
    middleHonor = {
      teamId: top.teamId,
      teamPublicId: top.teamPublicId,
      teamName: top.teamName,
      ownerName: top.ownerName,
      logoUrl: top.logoUrl,
      value: 1,
    };
  }

  let chokeArtist: LeagueHallOfFameData["chokeArtist"] = null;
  let fergieTime: LeagueHallOfFameData["fergieTime"] = null;

  const [seasonRow] = await db
    .select({
      scoringPreset: leagueSeasons.scoringPreset,
      settings: leagueSeasons.settings,
      benchSlots: leagueSeasons.benchSlots,
      irEnabled: leagueSeasons.irEnabled,
      irSlots: leagueSeasons.irSlots,
      taxiEnabled: leagueSeasons.taxiEnabled,
      taxiSlots: leagueSeasons.taxiSlots,
    })
    .from(leagueSeasons)
    .where(eq(leagueSeasons.id, input.leagueSeasonId))
    .limit(1)
    .catch(() => []);

  if (seasonRow && regularFinals.length > 0) {
    const swings = await loadHofLateGameSwingCounts({
      seasonYear: input.seasonYear,
      scoringPreset: seasonRow.scoringPreset as ScoringPreset,
      scoringRules: seasonRow.settings.scoringRules,
      rosterSlots: seasonRow.settings.rosterSlots,
      benchSlots: seasonRow.benchSlots,
      irEnabled: seasonRow.irEnabled,
      irSlots: seasonRow.irSlots,
      irEligibleStatuses: seasonRow.settings.irEligibleStatuses,
      taxiEnabled: seasonRow.taxiEnabled,
      taxiSlots: seasonRow.taxiSlots,
      finals: regularFinals,
    }).catch(() => ({
      choke: new Map<string, number>(),
      fergie: new Map<string, number>(),
    }));
    chokeArtist = pickTopCount(claimed, swings.choke);
    fergieTime = pickTopCount(claimed, swings.fergie);
  }

  return {
    mostTitles,
    middleHonor,
    middleHonorKind,
    mostRegularSeasonWins,
    allTimeTable,
    chokeArtist,
    fergieTime,
    luckiest,
    highestWinningScore: highest,
    lowestWinningScore: lowest,
  };
}
