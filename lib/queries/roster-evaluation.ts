import "server-only";

import { asc, eq } from "drizzle-orm";

import { teams } from "@/db/schema";
import { db } from "@/lib/db";
import {
  resolveScoringRuleDefinitions,
  type ScoringPreset,
} from "@/lib/leagues/scoring";
import { buildFilledRosterSections } from "@/lib/leagues/roster-fill";
import { buildScaffoldRosterEvaluation } from "@/lib/leagues/roster-evaluation/scaffold";
import { buildStarterSlotSpecs } from "@/lib/leagues/roster-evaluation/slot-specs";
import {
  buildOptimalFilledLineup,
  buildPositionalLabels,
  buildPositionalRankings,
  buildPositionStrength,
  buildStartingLineupRanks,
  startingLineupToRankRows,
  type RankablePlayer,
  type TeamRosterForEvaluation,
} from "@/lib/leagues/roster-evaluation/starting-lineup-ranks";
import type {
  RosterEvaluationData,
  RosterEvaluationMode,
} from "@/lib/leagues/roster-evaluation/types";
import { getLeagueBySlug, getLeagueSeason } from "@/lib/queries/leagues";
import { getRankedPlayers } from "@/lib/queries/players";
import { getTeamRosterPlayers } from "@/lib/queries/team-roster";

const MODES: RosterEvaluationMode[] = ["draft", "week", "rest-of-season"];

function projectionWeek(
  mode: RosterEvaluationMode,
  upcomingWeek: number,
): number {
  if (mode === "week") return Math.max(1, upcomingWeek);
  return 0;
}

async function loadLeaguePlayers(
  playerIds: string[],
  seasonYear: string,
  week: number,
  scoringRules: ReturnType<typeof resolveScoringRuleDefinitions>,
): Promise<Map<string, number>> {
  if (playerIds.length === 0) return new Map();
  const ranked = await getRankedPlayers({
    season: seasonYear,
    week,
    kind: "projection",
    scoringRules,
    playerIds,
  }).catch(() => []);
  return new Map(
    ranked.map((player) => [player.id, player.fantasyPts ?? 0] as const),
  );
}

function toRankable(
  players: Awaited<ReturnType<typeof getTeamRosterPlayers>>,
  ptsById: Map<string, number>,
): RankablePlayer[] {
  return players.map((player) => ({
    id: player.id,
    fullName: player.fullName,
    primaryPositionId: player.primaryPositionId,
    sleeperId: player.sleeperId,
    fantasyPts: ptsById.get(player.id) ?? 0,
  }));
}

function toProjectedMap(
  ptsById: Map<string, number>,
): Map<string, number | null> {
  return new Map(
    [...ptsById.entries()].map(([id, pts]) => [id, pts] as const),
  );
}

/**
 * Roster evaluation for all ranking modes.
 * - Starting Lineup: current starters vs league (by slot)
 * - Starter Rankings: optimal starters vs league (by slot)
 * - Positional Rankings: all rostered players at each primary position vs league
 * - Position Strength: starter vs bench cohorts per position
 */
export async function getRosterEvaluationByMode(input: {
  leagueSlug: string;
  teamId: string;
  upcomingWeek: number;
}): Promise<Record<RosterEvaluationMode, RosterEvaluationData> | null> {
  const league = await getLeagueBySlug(input.leagueSlug);
  if (!league) return null;

  const season = await getLeagueSeason(league.id);
  if (!season) return null;

  const seasonTeams = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.leagueSeasonId, season.id))
    .orderBy(asc(teams.draftSlot), asc(teams.createdAt));

  const teamIds = seasonTeams.map((row) => row.id);
  const teamCount = Math.max(1, teamIds.length);
  const rosterSlots = season.settings.rosterSlots;
  const slotSpecs = buildStarterSlotSpecs(rosterSlots);
  const positionalLabels = buildPositionalLabels(slotSpecs);
  const radarPositions = positionalLabels;
  const scoringRules = resolveScoringRuleDefinitions(
    season.scoringPreset as ScoringPreset,
    season.settings.scoringRules,
  );
  const seasonYear = String(season.seasonYear);
  const fillBase = {
    rosterSlots,
    benchSlots: season.benchSlots,
    irEnabled: season.irEnabled,
    irSlots: season.irSlots,
    irEligibleStatuses: season.settings.irEligibleStatuses,
    taxiEnabled: season.taxiEnabled,
    taxiSlots: season.taxiSlots,
  };

  const rosters = await Promise.all(
    teamIds.map(async (teamId) => ({
      teamId,
      players: await getTeamRosterPlayers(teamId),
    })),
  );

  const allPlayers = rosters.flatMap((row) => row.players);
  const allPlayerIds = [...new Set(allPlayers.map((player) => player.id))];

  const seasonPts = await loadLeaguePlayers(
    allPlayerIds,
    seasonYear,
    0,
    scoringRules,
  );
  const weekPts = await loadLeaguePlayers(
    allPlayerIds,
    seasonYear,
    Math.max(1, input.upcomingWeek),
    scoringRules,
  );

  const result = {} as Record<RosterEvaluationMode, RosterEvaluationData>;

  for (const mode of MODES) {
    const scaffold = buildScaffoldRosterEvaluation(mode);
    const ptsById =
      projectionWeek(mode, input.upcomingWeek) === 0 ? seasonPts : weekPts;
    const projectedById = toProjectedMap(ptsById);
    const leaguePlayers = toRankable(allPlayers, ptsById);

    const teamsForEval: TeamRosterForEvaluation[] = rosters.map((row) => {
      const sections = buildFilledRosterSections({
        ...fillBase,
        players: row.players,
      });
      return {
        teamId: row.teamId,
        players: toRankable(row.players, ptsById),
        lineup: sections.lineup,
        bench: sections.bench,
        rosterPlayers: row.players,
      };
    });

    const focus =
      teamsForEval.find((team) => team.teamId === input.teamId) ?? null;

    const startingLineup = focus
      ? buildStartingLineupRanks({
          teamCount,
          slotSpecs,
          focusLineup: focus.lineup,
          leaguePlayers,
        })
      : scaffold.startingLineup;

    const optimalLineup = focus
      ? buildOptimalFilledLineup({
          lineup: focus.lineup,
          rosterPlayers: focus.rosterPlayers,
          projectedById,
          irEligibleStatuses: season.settings.irEligibleStatuses,
        })
      : null;

    const starterRankings = optimalLineup
      ? startingLineupToRankRows(
          buildStartingLineupRanks({
            teamCount,
            slotSpecs,
            focusLineup: optimalLineup,
            leaguePlayers,
          }),
        )
      : scaffold.starterRankings;

    const positionalRankings = focus
      ? buildPositionalRankings({
          teamCount,
          focusTeamId: input.teamId,
          positionLabels: positionalLabels,
          teams: teamsForEval,
          leaguePlayers,
        })
      : scaffold.positionalRankings;

    const positionStrength = focus
      ? buildPositionStrength({
          teamCount,
          focusTeamId: input.teamId,
          positions: radarPositions,
          teams: teamsForEval,
          leaguePlayers,
        })
      : scaffold.positionStrength;

    result[mode] = {
      ...scaffold,
      teamCount,
      positionStrength,
      startingLineup,
      starterRankings,
      positionalRankings,
    };
  }

  return result;
}
