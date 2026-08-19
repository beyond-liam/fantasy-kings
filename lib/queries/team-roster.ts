import { and, eq } from "drizzle-orm";
import { cache } from "react";

import { playerExternalIds, players, rosterPlayers } from "@/db/schema";
import type { RosterSlotConfig, ScheduleSettings } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import type { TeamRosterPlayer } from "@/lib/leagues/roster-fill";
import { assignDefaultSlotsToUnassignedPlayers } from "@/lib/leagues/roster-writes";
import { applyDueLineupPlans } from "@/lib/queries/lineup-plans";
import { resolveFantasyMatchupWeek } from "@/lib/leagues/matchup-week";

export type {
  FilledRosterSections,
  FilledRosterSlot,
  TeamRosterPlayer,
} from "@/lib/leagues/roster-fill";
export {
  buildFilledRosterSections,
  fillRosterSections,
} from "@/lib/leagues/roster-fill";

/** Persist slots for trade leftovers with null `slotPositionId` before roster reads. */
export async function ensureTeamRosterSlotsAssigned(input: {
  teamId: string;
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  irEnabled?: boolean;
  taxiEnabled?: boolean;
  leagueSeasonId?: string;
  schedule?: ScheduleSettings | null;
  seasonYear?: number;
  regularSeasonEndWeek?: number;
  currentWeek?: number;
}) {
  await assignDefaultSlotsToUnassignedPlayers(input);
  if (!input.leagueSeasonId) return;

  let currentWeek = input.currentWeek;
  if (
    currentWeek == null &&
    input.seasonYear != null &&
    input.regularSeasonEndWeek != null
  ) {
    const resolved = await resolveFantasyMatchupWeek({
      seasonYear: input.seasonYear,
      nflRegularSeasonEndWeek: input.regularSeasonEndWeek,
      schedule: input.schedule,
    });
    currentWeek = resolved.currentWeek;
  }
  if (currentWeek == null) {
    currentWeek = 1;
  }
  await applyDueLineupPlans({
    leagueSeasonId: input.leagueSeasonId,
    currentWeek,
    rosterSlots: input.rosterSlots,
    benchSlots: input.benchSlots,
    teamId: input.teamId,
  });
}
export const getTeamRosterPlayers = cache(
  async (teamId: string): Promise<TeamRosterPlayer[]> => {
    return db
      .select({
        id: players.id,
        fullName: players.fullName,
        nflTeam: players.nflTeam,
        primaryPositionId: players.primaryPositionId,
        byeWeek: players.byeWeek,
        injuryStatus: players.injuryStatus,
        yearsExp: players.yearsExp,
        sleeperId: playerExternalIds.externalId,
        slotPositionId: rosterPlayers.slotPositionId,
        taxiActivated: rosterPlayers.taxiActivated,
        isKeeper: rosterPlayers.isKeeper,
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
          eq(rosterPlayers.teamId, teamId),
          eq(rosterPlayers.status, "rostered"),
        ),
      );
  },
);
