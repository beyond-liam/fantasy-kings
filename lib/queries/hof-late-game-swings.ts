import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { playerExternalIds, players, rosterPlayers } from "@/db/schema";
import { db } from "@/lib/db";
import { getNflScoreboard } from "@/lib/espn/scoreboard";
import {
  classifyLastKickoffSwing,
  countChokeAndFergieByTeam,
  type LateGameStarter,
} from "@/lib/leagues/game-centre/last-kickoff-swing";
import { kickoffForNflTeam } from "@/lib/leagues/game-centre/chart";
import {
  buildFilledRosterSections,
  type TeamRosterPlayer,
} from "@/lib/leagues/roster-fill";
import {
  resolveScoringRuleDefinitions,
  type ScoringPreset,
} from "@/lib/leagues/scoring";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import type { FinalMatchupRecord } from "@/lib/leagues/standings";
import { getRankedPlayers } from "@/lib/queries/players";

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
  input: {
    rosterSlots: RosterSlotConfig[];
    benchSlots: number;
    irEnabled: boolean;
    irSlots: number;
    irEligibleStatuses?: string[];
    taxiEnabled: boolean;
    taxiSlots: number;
  },
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

function toLateStarters(
  starters: TeamRosterPlayer[],
  actualById: Map<string, number | null>,
  games: Parameters<typeof kickoffForNflTeam>[1],
): LateGameStarter[] {
  return starters.map((player) => ({
    kickoff: kickoffForNflTeam(player.nflTeam, games),
    actualPts: actualById.get(player.id) ?? null,
  }));
}

/**
 * Reconstruct choke / Fergie counts from finalized matchups using current
 * starter slots + that week's actuals + ESPN kickoffs (same model as the
 * Game Centre score chart). Historical lineup snapshots are not stored yet.
 */
export async function loadHofLateGameSwingCounts(input: {
  seasonYear: number;
  scoringPreset: ScoringPreset;
  scoringRules: ScoringRuleDefinition[] | null | undefined;
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  irEnabled: boolean;
  irSlots: number;
  irEligibleStatuses?: string[];
  taxiEnabled: boolean;
  taxiSlots: number;
  finals: FinalMatchupRecord[];
}): Promise<{ choke: Map<string, number>; fergie: Map<string, number> }> {
  const empty = {
    choke: new Map<string, number>(),
    fergie: new Map<string, number>(),
  };
  const usable = input.finals.filter(
    (m) =>
      m.homePts != null &&
      m.awayPts != null &&
      m.homePts !== m.awayPts,
  );
  if (usable.length === 0) return empty;

  const teamIds = [
    ...new Set(usable.flatMap((m) => [m.homeTeamId, m.awayTeamId])),
  ];
  const rostersByTeam = await getRosterPlayersForTeams(teamIds);
  const rosterIds = [
    ...new Set(
      [...rostersByTeam.values()].flatMap((players) =>
        players.map((player) => player.id),
      ),
    ),
  ];
  if (rosterIds.length === 0) return empty;

  const scoringRules = resolveScoringRuleDefinitions(
    input.scoringPreset,
    input.scoringRules,
  );
  const fillInput = {
    rosterSlots: input.rosterSlots,
    benchSlots: input.benchSlots,
    irEnabled: input.irEnabled,
    irSlots: input.irSlots,
    irEligibleStatuses: input.irEligibleStatuses,
    taxiEnabled: input.taxiEnabled,
    taxiSlots: input.taxiSlots,
  };

  const byWeek = new Map<number, FinalMatchupRecord[]>();
  for (const matchup of usable) {
    const list = byWeek.get(matchup.week) ?? [];
    list.push(matchup);
    byWeek.set(matchup.week, list);
  }

  const swings = [];
  for (const [week, matchups] of byWeek) {
    const [scoreboard, weekStats] = await Promise.all([
      getNflScoreboard({ season: input.seasonYear, week }).catch(() => null),
      getRankedPlayers({
        season: String(input.seasonYear),
        week,
        kind: "stats",
        scoringRules,
        playerIds: rosterIds,
      }).catch(() => []),
    ]);
    const games = scoreboard?.games ?? [];
    if (games.length === 0) continue;

    const actualById = new Map(
      weekStats.map((player) => [player.id, player.fantasyPts]),
    );

    for (const matchup of matchups) {
      if (matchup.homePts == null || matchup.awayPts == null) continue;
      const homeStarters = toLateStarters(
        startersForTeam(rostersByTeam.get(matchup.homeTeamId) ?? [], fillInput),
        actualById,
        games,
      );
      const awayStarters = toLateStarters(
        startersForTeam(rostersByTeam.get(matchup.awayTeamId) ?? [], fillInput),
        actualById,
        games,
      );
      const swing = classifyLastKickoffSwing({
        homeTeamId: matchup.homeTeamId,
        awayTeamId: matchup.awayTeamId,
        homePts: matchup.homePts,
        awayPts: matchup.awayPts,
        homeStarters,
        awayStarters,
      });
      if (swing) swings.push(swing);
    }
  }

  return countChokeAndFergieByTeam(swings);
}
