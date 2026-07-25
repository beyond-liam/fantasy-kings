import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { playerExternalIds, players, rosterPlayers } from "@/db/schema";
import { db } from "@/lib/db";
import {
  buildFilledRosterSections,
  type TeamRosterPlayer,
} from "@/lib/leagues/roster-fill";
import type { ScoringRuleDefinition } from "@/lib/leagues/scoring/types";
import { getRankedPlayers } from "@/lib/queries/players";

type GetTeamProjectedWeeklyPfInput = {
  teamIds: string[];
  seasonYear: string;
  week: number;
  scoringRules: ScoringRuleDefinition[];
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  irEnabled: boolean;
  irSlots: number;
  irEligibleStatuses?: string[] | null;
  taxiEnabled: boolean;
  taxiSlots: number;
};

async function getRosterPlayersForTeams(
  teamIds: string[],
): Promise<Map<string, TeamRosterPlayer[]>> {
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
      yearsExp: players.yearsExp,
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
      yearsExp: row.yearsExp,
      sleeperId: row.sleeperId,
      slotPositionId: row.slotPositionId,
    });
    map.set(row.teamId, list);
  }
  return map;
}

/**
 * Sum of projected starter fantasy points for each team (current/next week).
 * Used for projected SOS / odds strength before PF/G exists.
 */
export async function getTeamProjectedWeeklyPf(
  input: GetTeamProjectedWeeklyPfInput,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  for (const teamId of input.teamIds) {
    result.set(teamId, 0);
  }
  if (input.teamIds.length === 0) return result;

  const rostersByTeam = await getRosterPlayersForTeams(input.teamIds);
  const allPlayerIds = [
    ...new Set(
      [...rostersByTeam.values()].flatMap((playersOnTeam) =>
        playersOnTeam.map((player) => player.id),
      ),
    ),
  ];
  if (allPlayerIds.length === 0) return result;

  const ranked = await getRankedPlayers({
    season: input.seasonYear,
    week: Math.max(1, input.week),
    kind: "projection",
    scoringRules: input.scoringRules,
    playerIds: allPlayerIds,
  }).catch(() => []);

  const projectedById = new Map(
    ranked.map((player) => [player.id, player.fantasyPts ?? 0] as const),
  );

  for (const teamId of input.teamIds) {
    const playersOnTeam = rostersByTeam.get(teamId) ?? [];
    const sections = buildFilledRosterSections({
      rosterSlots: input.rosterSlots,
      benchSlots: input.benchSlots,
      irEnabled: input.irEnabled,
      irSlots: input.irSlots,
      taxiEnabled: input.taxiEnabled,
      taxiSlots: input.taxiSlots,
      players: playersOnTeam,
      irEligibleStatuses: input.irEligibleStatuses ?? undefined,
    });
    let total = 0;
    for (const slot of sections.lineup) {
      if (!slot.player) continue;
      total += projectedById.get(slot.player.id) ?? 0;
    }
    result.set(teamId, Math.round(total * 10) / 10);
  }

  return result;
}
