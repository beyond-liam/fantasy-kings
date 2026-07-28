import { and, eq } from "drizzle-orm";
import { cache } from "react";

import { playerExternalIds, players, rosterPlayers } from "@/db/schema";
import { db } from "@/lib/db";
import type { TeamRosterPlayer } from "@/lib/leagues/roster-fill";

export type {
  FilledRosterSections,
  FilledRosterSlot,
  TeamRosterPlayer,
} from "@/lib/leagues/roster-fill";
export {
  buildFilledRosterSections,
  fillRosterSections,
} from "@/lib/leagues/roster-fill";

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
