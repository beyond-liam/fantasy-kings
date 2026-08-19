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

type EnsureTeamRosterSlotsAssignedBaseInput = {
  teamId: string;
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  irEnabled?: boolean;
  taxiEnabled?: boolean;
  leagueSeasonId?: string;
};

type EnsureTeamRosterSlotsAssignedInput =
  EnsureTeamRosterSlotsAssignedBaseInput & {
  schedule?: ScheduleSettings | null;
  seasonYear?: number;
  regularSeasonEndWeek?: number;
  currentWeek?: number;
};

type ResolveCurrentWeekInput = Pick<
  EnsureTeamRosterSlotsAssignedInput,
  "currentWeek" | "schedule" | "seasonYear" | "regularSeasonEndWeek"
> & {
  resolveWeek?: typeof resolveFantasyMatchupWeek;
};

export async function resolveCurrentWeekForTeamRoster(
  input: ResolveCurrentWeekInput,
): Promise<number> {
  if (input.currentWeek != null) {
    return input.currentWeek;
  }

  if (input.seasonYear != null && input.regularSeasonEndWeek != null) {
    const resolveWeek = input.resolveWeek ?? resolveFantasyMatchupWeek;
    const resolved = await resolveWeek({
      seasonYear: input.seasonYear,
      nflRegularSeasonEndWeek: input.regularSeasonEndWeek,
      schedule: input.schedule,
    });
    return resolved.currentWeek;
  }

  return 1;
}

/** Persist slots for trade leftovers with null `slotPositionId` before roster reads. */
const ensureTeamRosterSlotsAssignedForWeekCached = cache(
  async (
    teamId: string,
    leagueSeasonId: string,
    currentWeek: number,
    benchSlots: number,
    irEnabled: boolean,
    taxiEnabled: boolean,
    rosterSlotsKey: string,
  ) => {
    const rosterSlots = JSON.parse(rosterSlotsKey) as RosterSlotConfig[];
    await assignDefaultSlotsToUnassignedPlayers({
      teamId,
      rosterSlots,
      benchSlots,
      irEnabled,
      taxiEnabled,
    });
    if (!leagueSeasonId) return;
    await applyDueLineupPlans({
      leagueSeasonId,
      currentWeek,
      rosterSlots,
      benchSlots,
      teamId,
    });
  },
);

export async function ensureTeamRosterSlotsAssignedForWeek(
  input: EnsureTeamRosterSlotsAssignedBaseInput & { currentWeek: number },
) {
  return ensureTeamRosterSlotsAssignedForWeekCached(
    input.teamId,
    input.leagueSeasonId ?? "",
    input.currentWeek,
    input.benchSlots,
    input.irEnabled ?? false,
    input.taxiEnabled ?? false,
    JSON.stringify(input.rosterSlots),
  );
}

/** Persist slots for trade leftovers with null `slotPositionId` before roster reads. */
export async function ensureTeamRosterSlotsAssigned(
  input: EnsureTeamRosterSlotsAssignedInput,
) {
  const currentWeek = await resolveCurrentWeekForTeamRoster(input);
  await ensureTeamRosterSlotsAssignedForWeek({
    teamId: input.teamId,
    rosterSlots: input.rosterSlots,
    benchSlots: input.benchSlots,
    irEnabled: input.irEnabled,
    taxiEnabled: input.taxiEnabled,
    leagueSeasonId: input.leagueSeasonId,
    currentWeek,
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

export type TeamRosterLockSnapshot = {
  id: string;
  fullName: string;
  injuryStatus: string | null;
  slotPositionId: string | null;
  yearsExp: number | null;
};

/** Minimal roster read for IR/Taxi acquisition lock banners. */
export const getTeamRosterLockSnapshot = cache(
  async (teamId: string): Promise<TeamRosterLockSnapshot[]> => {
    return db
      .select({
        id: players.id,
        fullName: players.fullName,
        injuryStatus: players.injuryStatus,
        slotPositionId: rosterPlayers.slotPositionId,
        yearsExp: players.yearsExp,
      })
      .from(rosterPlayers)
      .innerJoin(players, eq(rosterPlayers.playerId, players.id))
      .where(
        and(
          eq(rosterPlayers.teamId, teamId),
          eq(rosterPlayers.status, "rostered"),
        ),
      );
  },
);
