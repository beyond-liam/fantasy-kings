"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { players, rosterPlayers, teams } from "@/db/schema";
import { db } from "@/lib/db";
import { logLeagueActivity } from "@/lib/leagues/activity-log";
import { loadLeagueActionContext } from "@/lib/leagues/action-context";
import {
  countActivePositionPlayers,
  countActiveRosterPlayers,
  getMaxRosterSize,
  getPositionRosterMax,
} from "@/lib/leagues/roster-capacity";
import {
  occupiedBySlot,
  pickDefaultSlotPosition,
} from "@/lib/leagues/roster-slots";
import {
  findSeasonRosterRows,
  listRosteredPlayers,
} from "@/lib/leagues/roster-writes";

const teamPlayerSchema = z.object({
  teamId: z.string().uuid(),
  playerId: z.string().uuid(),
});

export type CommishRosterActionResult = {
  success: boolean;
  error?: string;
  playerName?: string;
};

function revalidateCommishRosterPaths(slug: string) {
  revalidatePath(`/league/${slug}`);
  revalidatePath(`/league/${slug}/team`);
  revalidatePath(`/league/${slug}/players`);
  revalidatePath(`/league/${slug}/activity`);
  revalidatePath(`/league/${slug}/settings`);
  revalidatePath(`/league/${slug}/settings/edit-roster`);
}

async function loadCommishDynastyContext(slug: string) {
  const context = await loadLeagueActionContext(slug, {
    requireMembership: true,
    requireCommissioner: true,
    commissionerError: "Only the commissioner can edit rosters.",
  });
  if ("error" in context) {
    return context;
  }
  if (context.season.leagueType !== "dynasty") {
    return { error: "Roster edits are only available in dynasty leagues." };
  }
  return context;
}

export async function commishAddPlayerToRoster(
  slug: string,
  teamId: string,
  playerId: string,
): Promise<CommishRosterActionResult> {
  const parsed = teamPlayerSchema.safeParse({ teamId, playerId });
  if (!parsed.success) {
    return { success: false, error: "Invalid team or player." };
  }

  const context = await loadCommishDynastyContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { season, league, user } = context;
  const [team] = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(
      and(eq(teams.id, parsed.data.teamId), eq(teams.leagueSeasonId, season.id)),
    )
    .limit(1);
  if (!team) {
    return { success: false, error: "Team not found." };
  }

  const [player] = await db
    .select({
      id: players.id,
      fullName: players.fullName,
      primaryPositionId: players.primaryPositionId,
      injuryStatus: players.injuryStatus,
      yearsExp: players.yearsExp,
    })
    .from(players)
    .where(eq(players.id, parsed.data.playerId))
    .limit(1);
  if (!player) {
    return { success: false, error: "Player not found." };
  }

  const seasonRows = await findSeasonRosterRows(season.id, player.id);
  const rostered = seasonRows.find((row) => row.status === "rostered");
  if (rostered) {
    return {
      success: false,
      error:
        rostered.teamId === team.id
          ? "Player is already on this roster."
          : "Player is already on another team. Remove them first.",
    };
  }

  const rosteredOnTeam = await listRosteredPlayers(team.id);
  const maxRoster = getMaxRosterSize(
    season.settings.rosterSlots,
    season.benchSlots,
  );
  if (countActiveRosterPlayers(rosteredOnTeam) >= maxRoster) {
    return {
      success: false,
      error: "Roster is full. Remove a player first.",
    };
  }

  const positionMax = getPositionRosterMax(
    season.settings.rosterSlots,
    player.primaryPositionId,
  );
  const positionCount = countActivePositionPlayers(
    rosteredOnTeam,
    player.primaryPositionId,
  );
  if (
    positionMax !== Number.POSITIVE_INFINITY &&
    positionCount >= positionMax
  ) {
    return {
      success: false,
      error: `At max ${player.primaryPositionId}s. Remove a player first.`,
    };
  }

  const occupied = occupiedBySlot(
    rosteredOnTeam.filter((row) => row.slotPositionId != null),
  );
  const slotPositionId = pickDefaultSlotPosition({
    playerPositionId: player.primaryPositionId,
    injuryStatus: player.injuryStatus,
    yearsExp: player.yearsExp,
    rosterSlots: season.settings.rosterSlots ?? [],
    benchSlots: season.benchSlots,
    irEnabled: season.irEnabled,
    taxiEnabled: season.taxiEnabled,
    occupiedBySlot: occupied,
  });

  await db.transaction(async (tx) => {
    for (const row of seasonRows) {
      await tx.delete(rosterPlayers).where(eq(rosterPlayers.id, row.id));
    }
    await tx.insert(rosterPlayers).values({
      leagueSeasonId: season.id,
      teamId: team.id,
      playerId: player.id,
      status: "rostered",
      slotPositionId,
      waiverClearsAt: null,
      acquiredAt: new Date(),
    });
  });

  await logLeagueActivity({
    leagueSeasonId: season.id,
    type: "player_added",
    teamId: team.id,
    actorUserId: user.id,
    playerId: player.id,
    summary: `Commissioner added ${player.fullName} to ${team.name}`,
    metadata: {
      playerName: player.fullName,
      teamName: team.name,
      setByCommissioner: true,
    },
  });

  revalidateCommishRosterPaths(league.publicId);
  return { success: true, playerName: player.fullName };
}

export async function commishRemovePlayerFromRoster(
  slug: string,
  teamId: string,
  playerId: string,
): Promise<CommishRosterActionResult> {
  const parsed = teamPlayerSchema.safeParse({ teamId, playerId });
  if (!parsed.success) {
    return { success: false, error: "Invalid team or player." };
  }

  const context = await loadCommishDynastyContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { season, league, user } = context;
  const [team] = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(
      and(eq(teams.id, parsed.data.teamId), eq(teams.leagueSeasonId, season.id)),
    )
    .limit(1);
  if (!team) {
    return { success: false, error: "Team not found." };
  }

  const [row] = await db
    .select({
      id: rosterPlayers.id,
      fullName: players.fullName,
    })
    .from(rosterPlayers)
    .innerJoin(players, eq(rosterPlayers.playerId, players.id))
    .where(
      and(
        eq(rosterPlayers.teamId, team.id),
        eq(rosterPlayers.playerId, parsed.data.playerId),
        eq(rosterPlayers.status, "rostered"),
      ),
    )
    .limit(1);

  if (!row) {
    return { success: false, error: "Player is not on this roster." };
  }

  await db.delete(rosterPlayers).where(eq(rosterPlayers.id, row.id));

  await logLeagueActivity({
    leagueSeasonId: season.id,
    type: "player_dropped",
    teamId: team.id,
    actorUserId: user.id,
    playerId: parsed.data.playerId,
    summary: `Commissioner dropped ${row.fullName} from ${team.name}`,
    metadata: {
      playerName: row.fullName,
      teamName: team.name,
      setByCommissioner: true,
    },
  });

  revalidateCommishRosterPaths(league.publicId);
  return { success: true, playerName: row.fullName };
}
