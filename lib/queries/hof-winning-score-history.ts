import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { leagueSeasons, teamWeekStats, teams } from "@/db/schema";
import { profiles } from "@/db/schema/users";
import {
  countLuckyWinsByTeam,
  type HofTeamIdentity,
  type HofWinningScore,
} from "@/lib/leagues/hall-of-fame";
import { loadHofLateGameSwingCounts } from "@/lib/queries/hof-late-game-swings";
import type { ScoringPreset } from "@/lib/leagues/scoring";
import { getFinalMatchupsForSeasons } from "@/lib/leagues/matchups/finals";
import { excludeUnfinalizedGameWeek } from "@/lib/nfl/game-week";
import { getLeagueBySlug, getLeagueMembership } from "@/lib/queries/leagues";
import { formatPersonName } from "@/lib/account/person-name";
import { db } from "@/lib/db";

export type HofWinningScoreHistoryRow = HofWinningScore & {
  seasonYear: number;
  result: "W" | "L" | "T";
};

type LoadHofWinningScoreHistoryInput = {
  leagueSlug: string;
  userId: string;
  seasonYear?: number | null;
};

type HofScoreRow = HofWinningScore & {
  result: "W" | "L" | "T";
};

export type HofTeamCountHistoryRow = {
  teamId: string;
  teamPublicId: string | null;
  teamName: string;
  ownerName: string;
  logoUrl: string | null;
  seasonYear: number;
  value: number;
};

export type HofCountHistoryKind = "choke" | "fergie" | "luckiest";

type SeasonBase = {
  id: string;
  seasonYear: number;
  regularSeasonEndWeek: number;
  scoringPreset: ScoringPreset;
  benchSlots: number;
  irEnabled: boolean;
  irSlots: number;
  taxiEnabled: boolean;
  taxiSlots: number;
  settings: (typeof leagueSeasons.$inferSelect)["settings"];
};

function toHofTeams(
  rows: Array<{
    seasonId: string;
    teamId: string;
    teamPublicId: string | null;
    teamName: string;
    logoUrl: string | null;
    userId: string | null;
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  }>,
): Map<string, HofTeamIdentity[]> {
  const bySeason = new Map<string, HofTeamIdentity[]>();

  for (const row of rows) {
    const list = bySeason.get(row.seasonId) ?? [];
    list.push({
      teamId: row.teamId,
      teamPublicId: row.teamPublicId,
      teamName: row.teamName,
      ownerName: row.userId ? formatPersonName(row) : "Unclaimed",
      logoUrl: row.logoUrl,
      claimed: Boolean(row.userId),
    });
    bySeason.set(row.seasonId, list);
  }

  return bySeason;
}

function listScores(
  teams: HofTeamIdentity[],
  finals: Array<{
    week: number;
    homeTeamId: string;
    awayTeamId: string;
    homePts: number | null;
    awayPts: number | null;
  }>,
): HofScoreRow[] {
  const teamById = new Map(teams.map((team) => [team.teamId, team]));
  const rows: HofScoreRow[] = [];

  for (const matchup of finals) {
    if (matchup.homePts == null || matchup.awayPts == null) continue;

    const home = teamById.get(matchup.homeTeamId);
    const away = teamById.get(matchup.awayTeamId);

    if (home?.claimed) {
      const result =
        matchup.homePts > matchup.awayPts
          ? "W"
          : matchup.homePts < matchup.awayPts
            ? "L"
            : "T";
      rows.push({
        teamId: home.teamId,
        teamPublicId: home.teamPublicId,
        teamName: home.teamName,
        ownerName: home.ownerName,
        logoUrl: home.logoUrl,
        value: Math.round(matchup.homePts * 10) / 10,
        week: matchup.week,
        opponentName: away?.teamName ?? "Opponent",
        result,
      });
    }

    if (away?.claimed) {
      const result =
        matchup.awayPts > matchup.homePts
          ? "W"
          : matchup.awayPts < matchup.homePts
            ? "L"
            : "T";
      rows.push({
        teamId: away.teamId,
        teamPublicId: away.teamPublicId,
        teamName: away.teamName,
        ownerName: away.ownerName,
        logoUrl: away.logoUrl,
        value: Math.round(matchup.awayPts * 10) / 10,
        week: matchup.week,
        opponentName: home?.teamName ?? "Opponent",
        result,
      });
    }
  }

  return rows;
}

async function loadSeasonsAndTeams(input: LoadHofWinningScoreHistoryInput): Promise<{
  leagueSlug: string;
  availableYears: number[];
  selectedYear: number | null;
} | null> {
  const league = await getLeagueBySlug(input.leagueSlug);
  if (!league) return null;

  const membership = await getLeagueMembership(league.id, input.userId);
  if (!membership) return null;

  const seasons = await db
    .select({
      id: leagueSeasons.id,
      seasonYear: leagueSeasons.seasonYear,
      regularSeasonEndWeek: leagueSeasons.regularSeasonEndWeek,
      scoringPreset: leagueSeasons.scoringPreset,
      benchSlots: leagueSeasons.benchSlots,
      irEnabled: leagueSeasons.irEnabled,
      irSlots: leagueSeasons.irSlots,
      taxiEnabled: leagueSeasons.taxiEnabled,
      taxiSlots: leagueSeasons.taxiSlots,
      settings: leagueSeasons.settings,
    })
    .from(leagueSeasons)
    .where(eq(leagueSeasons.leagueId, league.id))
    .orderBy(desc(leagueSeasons.seasonYear));

  const availableYears = seasons.map((season) => season.seasonYear);
  const selectedYear =
    input.seasonYear != null && availableYears.includes(input.seasonYear)
      ? input.seasonYear
      : null;
  return {
    leagueSlug: league.publicId,
    availableYears,
    selectedYear,
  };
}

async function loadScoreHistory(
  input: LoadHofWinningScoreHistoryInput,
  metric: "highest" | "lowest",
): Promise<{
  leagueSlug: string;
  availableYears: number[];
  selectedYear: number | null;
  rows: HofWinningScoreHistoryRow[];
} | null> {
  const base = await loadSeasonsAndTeams(input);
  if (!base) return null;
  const league = await getLeagueBySlug(input.leagueSlug);
  if (!league) return null;

  const seasons = await db
    .select({
      id: leagueSeasons.id,
      seasonYear: leagueSeasons.seasonYear,
      settings: leagueSeasons.settings,
    })
    .from(leagueSeasons)
    .where(eq(leagueSeasons.leagueId, league.id))
    .orderBy(desc(leagueSeasons.seasonYear));

  const filteredSeasons =
    base.selectedYear == null
      ? seasons
      : seasons.filter((season) => season.seasonYear === base.selectedYear);
  const seasonIds = filteredSeasons.map((season) => season.id);
  if (seasonIds.length === 0) {
    return { ...base, rows: [] };
  }
  const [teamRows, finalsBySeason] = await Promise.all([
    db
      .select({
        seasonId: teams.leagueSeasonId,
        teamId: teams.id,
        teamPublicId: teams.publicId,
        teamName: teams.name,
        logoUrl: teams.logoUrl,
        userId: teams.userId,
        displayName: profiles.displayName,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        username: profiles.username,
      })
      .from(teams)
      .leftJoin(profiles, eq(teams.userId, profiles.id))
      .where(inArray(teams.leagueSeasonId, seasonIds)),
    getFinalMatchupsForSeasons(seasonIds),
  ]);
  const teamsBySeason = toHofTeams(teamRows);
  const { getGameWeekCloseState } = await import("@/lib/nfl/current-week-board");
  const rows: HofWinningScoreHistoryRow[] = [];
  for (const season of filteredSeasons) {
    const close = await getGameWeekCloseState(season.settings.schedule);
    const finals = excludeUnfinalizedGameWeek(
      finalsBySeason.get(season.id) ?? [],
      close.fantasyWeek,
      close.weekFinalized,
    );

    for (const row of listScores(teamsBySeason.get(season.id) ?? [], finals)) {
      rows.push({
        ...row,
        seasonYear: season.seasonYear,
      });
    }
  }
  const sorted = rows.toSorted((a, b) =>
    metric === "highest"
      ? b.value - a.value ||
        b.seasonYear - a.seasonYear ||
        b.week - a.week ||
        a.teamName.localeCompare(b.teamName)
      : a.value - b.value ||
        b.seasonYear - a.seasonYear ||
        b.week - a.week ||
        a.teamName.localeCompare(b.teamName),
  );
  return {
    ...base,
    rows: sorted.slice(0, 10),
  };
}

function addCounts(
  target: Map<string, number>,
  source: Map<string, number>,
) {
  for (const [teamId, value] of source) {
    if (value <= 0) continue;
    target.set(teamId, (target.get(teamId) ?? 0) + value);
  }
}

function topCountRows(
  seasonYear: number,
  counts: Map<string, number>,
  teamsById: Map<string, HofTeamIdentity>,
): HofTeamCountHistoryRow[] {
  const rows: HofTeamCountHistoryRow[] = [];
  for (const [teamId, value] of counts) {
    const team = teamsById.get(teamId);
    if (!team?.claimed || value <= 0) continue;
    rows.push({
      teamId: team.teamId,
      teamPublicId: team.teamPublicId,
      teamName: team.teamName,
      ownerName: team.ownerName,
      logoUrl: team.logoUrl,
      seasonYear,
      value,
    });
  }
  return rows;
}

export async function loadHofHighestWinningScoreHistory(
  input: LoadHofWinningScoreHistoryInput,
) {
  return loadScoreHistory(input, "highest");
}

export async function loadHofLowestScoreHistory(
  input: LoadHofWinningScoreHistoryInput,
) {
  return loadScoreHistory(input, "lowest");
}

export async function loadHofCountHistory(
  input: LoadHofWinningScoreHistoryInput & { kind: HofCountHistoryKind },
): Promise<{
  leagueSlug: string;
  availableYears: number[];
  selectedYear: number | null;
  rows: HofTeamCountHistoryRow[];
} | null> {
  const base = await loadSeasonsAndTeams(input);
  if (!base) return null;
  const league = await getLeagueBySlug(input.leagueSlug);
  if (!league) return null;

  const seasons = (await db
    .select({
      id: leagueSeasons.id,
      seasonYear: leagueSeasons.seasonYear,
      regularSeasonEndWeek: leagueSeasons.regularSeasonEndWeek,
      scoringPreset: leagueSeasons.scoringPreset,
      benchSlots: leagueSeasons.benchSlots,
      irEnabled: leagueSeasons.irEnabled,
      irSlots: leagueSeasons.irSlots,
      taxiEnabled: leagueSeasons.taxiEnabled,
      taxiSlots: leagueSeasons.taxiSlots,
      settings: leagueSeasons.settings,
    })
    .from(leagueSeasons)
    .where(eq(leagueSeasons.leagueId, league.id))
    .orderBy(desc(leagueSeasons.seasonYear))) as SeasonBase[];

  const filteredSeasons =
    base.selectedYear == null
      ? seasons
      : seasons.filter((season) => season.seasonYear === base.selectedYear);

  const seasonIds = filteredSeasons.map((season) => season.id);
  if (seasonIds.length === 0) {
    return { ...base, rows: [] };
  }

  const [teamRows, finalsBySeason] = await Promise.all([
    db
      .select({
        seasonId: teams.leagueSeasonId,
        teamId: teams.id,
        teamPublicId: teams.publicId,
        teamName: teams.name,
        logoUrl: teams.logoUrl,
        userId: teams.userId,
        displayName: profiles.displayName,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        username: profiles.username,
      })
      .from(teams)
      .leftJoin(profiles, eq(teams.userId, profiles.id))
      .where(inArray(teams.leagueSeasonId, seasonIds)),
    getFinalMatchupsForSeasons(seasonIds),
  ]);

  const teamsBySeason = toHofTeams(teamRows);
  const { getGameWeekCloseState } = await import("@/lib/nfl/current-week-board");

  const allRows: HofTeamCountHistoryRow[] = [];
  for (const season of filteredSeasons) {
    const close = await getGameWeekCloseState(season.settings.schedule);
    const finals = excludeUnfinalizedGameWeek(
      finalsBySeason.get(season.id) ?? [],
      close.fantasyWeek,
      close.weekFinalized,
    );
    const regularFinals = finals.filter(
      (matchup) => matchup.week <= season.regularSeasonEndWeek,
    );
    if (regularFinals.length === 0) continue;

    const seasonTeams = teamsBySeason.get(season.id) ?? [];
    const teamsById = new Map(seasonTeams.map((team) => [team.teamId, team]));
    const counts = new Map<string, number>();

    if (input.kind === "choke" || input.kind === "fergie") {
      const swings = await loadHofLateGameSwingCounts({
        seasonYear: season.seasonYear,
        scoringPreset: season.scoringPreset,
        scoringRules: season.settings.scoringRules,
        rosterSlots: season.settings.rosterSlots,
        benchSlots: season.benchSlots,
        irEnabled: season.irEnabled,
        irSlots: season.irSlots,
        irEligibleStatuses: season.settings.irEligibleStatuses,
        taxiEnabled: season.taxiEnabled,
        taxiSlots: season.taxiSlots,
        finals: regularFinals,
      }).catch(() => ({
        choke: new Map<string, number>(),
        fergie: new Map<string, number>(),
      }));
      addCounts(counts, input.kind === "choke" ? swings.choke : swings.fergie);
    } else {
      const weeks = [...new Set(regularFinals.map((matchup) => matchup.week))];
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
                  eq(teamWeekStats.leagueSeasonId, season.id),
                  inArray(teamWeekStats.week, weeks),
                ),
              )
              .catch(() => []);
      const opfByTeamWeek = new Map<string, number>();
      for (const row of opfRows) {
        if (row.optimumPointsFor == null) continue;
        opfByTeamWeek.set(`${row.teamId}:${row.week}`, row.optimumPointsFor);
      }
      const luckyFinals = regularFinals.map((matchup) => ({
        ...matchup,
        homeOptimum:
          opfByTeamWeek.get(`${matchup.homeTeamId}:${matchup.week}`) ?? null,
        awayOptimum:
          opfByTeamWeek.get(`${matchup.awayTeamId}:${matchup.week}`) ?? null,
      }));
      addCounts(counts, countLuckyWinsByTeam(luckyFinals));
    }

    allRows.push(...topCountRows(season.seasonYear, counts, teamsById));
  }

  return {
    ...base,
    rows: allRows
      .toSorted(
        (a, b) =>
          b.value - a.value ||
          b.seasonYear - a.seasonYear ||
          a.teamName.localeCompare(b.teamName),
      )
      .slice(0, 10),
  };
}
