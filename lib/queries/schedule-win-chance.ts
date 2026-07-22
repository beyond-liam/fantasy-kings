import { and, eq, inArray } from "drizzle-orm";

import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { playerExternalIds, players, rosterPlayers } from "@/db/schema";
import { db } from "@/lib/db";
import type { ScheduleGame } from "@/lib/espn/scoreboard";
import {
  buildFilledRosterSections,
  type TeamRosterPlayer,
} from "@/lib/leagues/roster-fill";
import {
  matchupWinChance,
  resolveGameProgress,
  type GameProgress,
  type WinProbPlayer,
} from "@/lib/leagues/win-probability";
import { normalizeNflTeamAbbrev } from "@/lib/nfl/matchups";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import type { TeamScheduleRow } from "@/lib/queries/matchups";
import { getRankedPlayers } from "@/lib/queries/players";

type EnrichScheduleWinChancesInput = {
  focusTeamId: string;
  schedule: TeamScheduleRow[];
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  irEnabled: boolean;
  irSlots: number;
  irEligibleStatuses?: string[];
  taxiEnabled: boolean;
  taxiSlots: number;
  seasonYear: string;
  /** NFL week used for live/current scoreboard status. */
  currentWeek: number;
  scoringRules: ScoringRuleDefinition[];
  scoreboardGames: ScheduleGame[];
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
    if (home) {
      map.set(home, progress);
    }
    if (away) {
      map.set(away, progress);
    }
  }
  return map;
}

async function getRosterPlayersForTeams(
  teamIds: string[],
): Promise<Map<string, TeamRosterPlayer[]>> {
  const map = new Map<string, TeamRosterPlayer[]>();
  if (teamIds.length === 0) {
    return map;
  }

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
    EnrichScheduleWinChancesInput,
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

/**
 * Attach a win-probability for each schedule matchup using current starters.
 *
 * TODO(live-win-prob): Revisit accuracy against live weeks — projections only
 * exist ahead of time; in-game σ/pace need real scoring feeds to calibrate.
 */
export async function enrichScheduleWinChances(
  input: EnrichScheduleWinChancesInput,
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  if (input.schedule.length === 0) {
    return result;
  }

  const teamIds = [
    ...new Set([
      input.focusTeamId,
      ...input.schedule.map((row) => row.opponentTeamId),
    ]),
  ];

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
    for (const row of input.schedule) {
      result.set(row.id, null);
    }
    return result;
  }

  const weeks = [...new Set(input.schedule.map((row) => row.week))];
  const liveProgress = buildProgressByNflTeam(input.scoreboardGames);

  const weekData = new Map<
    number,
    {
      projectedById: Map<string, number | null>;
      actualById: Map<string, number | null>;
      progressByNflTeam: Map<string, GameProgress>;
    }
  >();

  await Promise.all(
    weeks.map(async (week) => {
      const useLiveClock = week === input.currentWeek;
      const [projections, actuals] = await Promise.all([
        getRankedPlayers({
          season: input.seasonYear,
          week,
          kind: "projection",
          scoringRules: input.scoringRules,
          playerIds: allStarterIds,
        }).catch(() => []),
        week <= input.currentWeek
          ? getRankedPlayers({
              season: input.seasonYear,
              week,
              kind: "stats",
              scoringRules: input.scoringRules,
              playerIds: allStarterIds,
            }).catch(() => [])
          : Promise.resolve([]),
      ]);

      weekData.set(week, {
        projectedById: new Map(
          projections.map((player) => [player.id, player.fantasyPts]),
        ),
        actualById: new Map(
          actuals.map((player) => [player.id, player.fantasyPts]),
        ),
        progressByNflTeam: useLiveClock
          ? liveProgress
          : week < input.currentWeek
            ? new Map() // finished weeks: expectedPlayerPoints treats missing progress as pre unless we force post
            : new Map(),
      });
    }),
  );

  for (const row of input.schedule) {
    const data = weekData.get(row.week);
    if (!data) {
      result.set(row.id, null);
      continue;
    }

    // Past weeks: treat all NFL games as final so actuals dominate.
    let progressByNflTeam = data.progressByNflTeam;
    if (row.week < input.currentWeek) {
      progressByNflTeam = new Map();
      for (const player of [
        ...(startersByTeam.get(input.focusTeamId) ?? []),
        ...(startersByTeam.get(row.opponentTeamId) ?? []),
      ]) {
        const abbrev = normalizeNflTeamAbbrev(player.nflTeam);
        if (abbrev) {
          progressByNflTeam.set(abbrev, {
            status: "post",
            fractionPlayed: 1,
          });
        }
      }
    } else if (row.week > input.currentWeek) {
      progressByNflTeam = new Map(); // all pre → projections
    }

    const focus = toWinProbPlayers(
      startersByTeam.get(input.focusTeamId) ?? [],
      data.projectedById,
      data.actualById,
    );
    const opponent = toWinProbPlayers(
      startersByTeam.get(row.opponentTeamId) ?? [],
      data.projectedById,
      data.actualById,
    );

    if (focus.length === 0 && opponent.length === 0) {
      result.set(row.id, null);
      continue;
    }

    const chance = matchupWinChance({
      focusStarters: focus,
      opponentStarters: opponent,
      progressByNflTeam,
    });
    result.set(row.id, chance.winProbability);
  }

  return result;
}
