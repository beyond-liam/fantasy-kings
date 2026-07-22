import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { playerExternalIds, players, rosterPlayers } from "@/db/schema";
import { db } from "@/lib/db";
import type { ScheduleGame } from "@/lib/espn/scoreboard";
import {
  buildFilledRosterSections,
  type TeamRosterPlayer,
} from "@/lib/leagues/roster-fill";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import {
  matchupWinChance,
  resolveGameProgress,
  type GameProgress,
  type MatchupWinChance,
  type WinProbPlayer,
} from "@/lib/leagues/win-probability";
import { normalizeNflTeamAbbrev } from "@/lib/nfl/matchups";
import type { LeagueMatchupRow } from "@/lib/queries/matchups";
import { getRankedPlayers } from "@/lib/queries/players";

export type MatchupBoardSide = {
  teamId: string;
  teamName: string;
  teamSlug: string;
  logoUrl: string | null;
  wins: number;
  losses: number;
  ties: number;
  /** 0–1 probability this side wins. */
  winChance: number | null;
  projectedPts: number | null;
  /** null = game not started / no actuals yet (show —). */
  actualPts: number | null;
  isLoser: boolean;
};

export type MatchupBoardGame = {
  id: string;
  /** Short URL segment for Game Centre links. */
  publicId: string;
  week: number;
  /** True when both sides have final actuals for the week. */
  resultFinal: boolean;
  away: MatchupBoardSide;
  home: MatchupBoardSide;
};

export type EnrichWeekMatchupBoardInput = {
  matchups: LeagueMatchupRow[];
  week: number;
  currentWeek: number;
  seasonYear: string;
  scoringRules: ScoringRuleDefinition[];
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  irEnabled: boolean;
  irSlots: number;
  irEligibleStatuses?: string[];
  taxiEnabled: boolean;
  taxiSlots: number;
  scoreboardGames: ScheduleGame[];
  recordsByTeamId?: Map<
    string,
    { wins: number; losses: number; ties: number }
  >;
};

function buildProgressByNflTeam(
  games: ScheduleGame[],
): Map<string, GameProgress> {
  const map = new Map<string, GameProgress>();
  for (const game of games) {
    const progress = resolveGameProgress({
      status: game.status,
      period: game.period,
      displayClock: game.displayClock,
    });
    const home = normalizeNflTeamAbbrev(game.home.abbreviation);
    const away = normalizeNflTeamAbbrev(game.away.abbreviation);
    if (home) map.set(home, progress);
    if (away) map.set(away, progress);
  }
  return map;
}

async function getRosterPlayersForTeams(teamIds: string[]) {
  const map = new Map<string, TeamRosterPlayer[]>();
  if (teamIds.length === 0) return map;

  const rows = await db
    .select({
      teamId: rosterPlayers.teamId,
      id: players.id,
      fullName: players.fullName,
      nflTeam: players.nflTeam,
      primaryPositionId: players.primaryPositionId,
      byeWeek: players.byeWeek,
      injuryStatus: players.injuryStatus,
      sleeperId: playerExternalIds.externalId,
      slotPositionId: rosterPlayers.slotPositionId,
    })
    .from(rosterPlayers)
    .innerJoin(players, eq(rosterPlayers.playerId, players.id))
    .leftJoin(
      playerExternalIds,
      and(
        eq(playerExternalIds.playerId, players.id),
        eq(playerExternalIds.provider, "sleeper"),
      ),
    )
    .where(
      and(
        inArray(rosterPlayers.teamId, teamIds),
        eq(rosterPlayers.status, "rostered"),
      ),
    );

  for (const row of rows) {
    const list = map.get(row.teamId) ?? [];
    list.push({
      id: row.id,
      fullName: row.fullName,
      nflTeam: row.nflTeam,
      primaryPositionId: row.primaryPositionId,
      byeWeek: row.byeWeek,
      injuryStatus: row.injuryStatus,
      sleeperId: row.sleeperId,
      slotPositionId: row.slotPositionId,
    });
    map.set(row.teamId, list);
  }

  return map;
}

function startersForTeam(
  playersOnTeam: TeamRosterPlayer[],
  input: Pick<
    EnrichWeekMatchupBoardInput,
    | "rosterSlots"
    | "benchSlots"
    | "irEnabled"
    | "irSlots"
    | "irEligibleStatuses"
    | "taxiEnabled"
    | "taxiSlots"
  >,
): TeamRosterPlayer[] {
  const sections = buildFilledRosterSections({
    rosterSlots: input.rosterSlots,
    benchSlots: input.benchSlots,
    irEnabled: input.irEnabled,
    irSlots: input.irSlots,
    taxiEnabled: input.taxiEnabled,
    taxiSlots: input.taxiSlots,
    players: playersOnTeam,
    irEligibleStatuses: input.irEligibleStatuses,
  });

  return sections.lineup
    .map((slot) => slot.player)
    .filter((player): player is TeamRosterPlayer => player != null);
}

function toWinProbPlayers(
  starters: TeamRosterPlayer[],
  projectedById: Map<string, number | null>,
  actualById: Map<string, number | null>,
): WinProbPlayer[] {
  return starters.map((player) => ({
    id: player.id,
    primaryPositionId: player.primaryPositionId,
    nflTeam: player.nflTeam,
    projectedPts: projectedById.get(player.id) ?? null,
    actualPts: actualById.get(player.id) ?? null,
  }));
}

function sumProjected(players: WinProbPlayer[]) {
  let total = 0;
  let any = false;
  for (const player of players) {
    if (player.projectedPts == null) continue;
    total += player.projectedPts;
    any = true;
  }
  return any ? total : null;
}

function sumActual(players: WinProbPlayer[]) {
  let total = 0;
  for (const player of players) {
    total += player.actualPts ?? 0;
  }
  return total;
}

function anyStarterStarted(
  lineup: WinProbPlayer[],
  progressByNflTeam: Map<string, GameProgress>,
) {
  return lineup.some((player) => {
    const abbrev = normalizeNflTeamAbbrev(player.nflTeam);
    if (!abbrev) return false;
    const progress = progressByNflTeam.get(abbrev);
    return progress?.status === "in" || progress?.status === "post";
  });
}

function allStartersFinal(
  lineup: WinProbPlayer[],
  progressByNflTeam: Map<string, GameProgress>,
) {
  if (lineup.length === 0) return false;
  return lineup.every((player) => {
    const abbrev = normalizeNflTeamAbbrev(player.nflTeam);
    if (!abbrev) return true;
    const progress = progressByNflTeam.get(abbrev);
    return progress == null || progress.status === "post";
  });
}

function progressForWeek(input: {
  week: number;
  currentWeek: number;
  scoreboardGames: ScheduleGame[];
  starters: TeamRosterPlayer[];
}): Map<string, GameProgress> {
  if (input.week > input.currentWeek) {
    return new Map();
  }

  if (input.week < input.currentWeek) {
    const map = new Map<string, GameProgress>();
    for (const player of input.starters) {
      const abbrev = normalizeNflTeamAbbrev(player.nflTeam);
      if (abbrev) {
        map.set(abbrev, { status: "post", fractionPlayed: 1 });
      }
    }
    return map;
  }

  return buildProgressByNflTeam(input.scoreboardGames);
}

function emptySide(
  teamId: string,
  teamName: string,
  teamSlug: string,
  logoUrl: string | null,
  recordsByTeamId: Map<string, { wins: number; losses: number; ties: number }>,
): MatchupBoardSide {
  const record = recordsByTeamId.get(teamId) ?? {
    wins: 0,
    losses: 0,
    ties: 0,
  };
  return {
    teamId,
    teamName,
    teamSlug,
    logoUrl,
    wins: record.wins,
    losses: record.losses,
    ties: record.ties,
    winChance: null,
    projectedPts: null,
    actualPts: null,
    isLoser: false,
  };
}

function buildSide(input: {
  teamId: string;
  teamName: string;
  teamSlug: string;
  logoUrl: string | null;
  players: WinProbPlayer[];
  chance: MatchupWinChance | null;
  isAway: boolean;
  progressByNflTeam: Map<string, GameProgress>;
  week: number;
  currentWeek: number;
  recordsByTeamId: Map<string, { wins: number; losses: number; ties: number }>;
}): MatchupBoardSide {
  const record = input.recordsByTeamId.get(input.teamId) ?? {
    wins: 0,
    losses: 0,
    ties: 0,
  };

  const projectedPts = sumProjected(input.players);
  const started =
    input.week < input.currentWeek ||
    anyStarterStarted(input.players, input.progressByNflTeam);
  const actualPts = started ? sumActual(input.players) : null;

  return {
    teamId: input.teamId,
    teamName: input.teamName,
    teamSlug: input.teamSlug,
    logoUrl: input.logoUrl,
    wins: record.wins,
    losses: record.losses,
    ties: record.ties,
    winChance: input.chance
      ? input.isAway
        ? input.chance.winProbability
        : 1 - input.chance.winProbability
      : null,
    projectedPts,
    actualPts,
    isLoser: false,
  };
}

/**
 * Enrich a week's H2H matchups with win%, projected/actual totals for the board UI.
 *
 * TODO(live-win-prob): Same live-accuracy caveats as schedule win chance.
 */
export async function enrichWeekMatchupBoard(
  input: EnrichWeekMatchupBoardInput,
): Promise<MatchupBoardGame[]> {
  if (input.matchups.length === 0) return [];

  const teamIds = [
    ...new Set(
      input.matchups.flatMap((m) => [m.awayTeamId, m.homeTeamId]),
    ),
  ];

  const recordsByTeamId =
    input.recordsByTeamId ??
    new Map<string, { wins: number; losses: number; ties: number }>();

  const rostersByTeam = await getRosterPlayersForTeams(teamIds);
  const startersByTeam = new Map<string, TeamRosterPlayer[]>();
  for (const teamId of teamIds) {
    startersByTeam.set(
      teamId,
      startersForTeam(rostersByTeam.get(teamId) ?? [], input),
    );
  }

  const allStarterIds = [
    ...new Set(
      [...startersByTeam.values()].flatMap((starters) =>
        starters.map((player) => player.id),
      ),
    ),
  ];

  if (allStarterIds.length === 0) {
    return input.matchups.map((m) => ({
      id: m.id,
      publicId: m.publicId,
      week: m.week,
      resultFinal: false,
      away: emptySide(
        m.awayTeamId,
        m.awayTeamName,
        m.awayTeamSlug,
        m.awayTeamLogoUrl,
        recordsByTeamId,
      ),
      home: emptySide(
        m.homeTeamId,
        m.homeTeamName,
        m.homeTeamSlug,
        m.homeTeamLogoUrl,
        recordsByTeamId,
      ),
    }));
  }

  const [projections, actuals] = await Promise.all([
    getRankedPlayers({
      season: input.seasonYear,
      week: input.week,
      kind: "projection",
      scoringRules: input.scoringRules,
      playerIds: allStarterIds,
    }).catch(() => []),
    input.week <= input.currentWeek
      ? getRankedPlayers({
          season: input.seasonYear,
          week: input.week,
          kind: "stats",
          scoringRules: input.scoringRules,
          playerIds: allStarterIds,
        }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const projectedById = new Map(
    projections.map((player) => [player.id, player.fantasyPts]),
  );
  const actualById = new Map(
    actuals.map((player) => [player.id, player.fantasyPts]),
  );

  const allStarters = [...startersByTeam.values()].flat();
  const progressByNflTeam = progressForWeek({
    week: input.week,
    currentWeek: input.currentWeek,
    scoreboardGames: input.scoreboardGames,
    starters: allStarters,
  });

  return input.matchups.map((m) => {
    const awayStarters = toWinProbPlayers(
      startersByTeam.get(m.awayTeamId) ?? [],
      projectedById,
      actualById,
    );
    const homeStarters = toWinProbPlayers(
      startersByTeam.get(m.homeTeamId) ?? [],
      projectedById,
      actualById,
    );

    const chance =
      awayStarters.length === 0 && homeStarters.length === 0
        ? null
        : matchupWinChance({
            focusStarters: awayStarters,
            opponentStarters: homeStarters,
            progressByNflTeam,
          });

    const away = buildSide({
      teamId: m.awayTeamId,
      teamName: m.awayTeamName,
      teamSlug: m.awayTeamSlug,
      logoUrl: m.awayTeamLogoUrl,
      players: awayStarters,
      chance,
      isAway: true,
      progressByNflTeam,
      week: input.week,
      currentWeek: input.currentWeek,
      recordsByTeamId,
    });
    const home = buildSide({
      teamId: m.homeTeamId,
      teamName: m.homeTeamName,
      teamSlug: m.homeTeamSlug,
      logoUrl: m.homeTeamLogoUrl,
      players: homeStarters,
      chance,
      isAway: false,
      progressByNflTeam,
      week: input.week,
      currentWeek: input.currentWeek,
      recordsByTeamId,
    });

    const resultFinal =
      input.week < input.currentWeek ||
      (away.actualPts != null &&
        home.actualPts != null &&
        allStartersFinal(
          [...awayStarters, ...homeStarters],
          progressByNflTeam,
        ));

    if (
      resultFinal &&
      away.actualPts != null &&
      home.actualPts != null
    ) {
      if (away.actualPts < home.actualPts - 0.05) {
        away.isLoser = true;
      } else if (home.actualPts < away.actualPts - 0.05) {
        home.isLoser = true;
      }
    }

    return {
      id: m.id,
      publicId: m.publicId,
      week: m.week,
      resultFinal:
        Boolean(resultFinal) &&
        away.actualPts != null &&
        home.actualPts != null,
      away,
      home,
    };
  });
}
