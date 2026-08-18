import "server-only";

import { and, eq, lte } from "drizzle-orm";

import type { RosterSlotConfig } from "@/db/schema/league-seasons";
import { rosterPlayers, teamWeekLineupPlans } from "@/db/schema";
import { db } from "@/lib/db";
import {
  lineupPlanFitsRoster,
  overlayPlanSlots,
} from "@/lib/leagues/lineup-plans";
import { listRosteredPlayers } from "@/lib/leagues/roster-writes";

export async function getTeamLineupPlanSlots(input: {
  leagueSeasonId: string;
  teamId: string;
  week: number;
}): Promise<Map<string, string>> {
  const rows = await db
    .select({
      playerId: teamWeekLineupPlans.playerId,
      slotPositionId: teamWeekLineupPlans.slotPositionId,
    })
    .from(teamWeekLineupPlans)
    .where(
      and(
        eq(teamWeekLineupPlans.leagueSeasonId, input.leagueSeasonId),
        eq(teamWeekLineupPlans.teamId, input.teamId),
        eq(teamWeekLineupPlans.week, input.week),
      ),
    );

  const slots = new Map<string, string>();
  for (const row of rows) {
    if (row.slotPositionId) {
      slots.set(row.playerId, row.slotPositionId);
    }
  }
  return slots;
}

export async function getLineupPlansByTeam(
  leagueSeasonId: string,
  week: number,
): Promise<Map<string, Map<string, string>>> {
  const rows = await db
    .select({
      teamId: teamWeekLineupPlans.teamId,
      playerId: teamWeekLineupPlans.playerId,
      slotPositionId: teamWeekLineupPlans.slotPositionId,
    })
    .from(teamWeekLineupPlans)
    .where(
      and(
        eq(teamWeekLineupPlans.leagueSeasonId, leagueSeasonId),
        eq(teamWeekLineupPlans.week, week),
      ),
    );

  const byTeam = new Map<string, Map<string, string>>();
  for (const row of rows) {
    if (!row.slotPositionId) continue;
    const slots = byTeam.get(row.teamId) ?? new Map<string, string>();
    slots.set(row.playerId, row.slotPositionId);
    byTeam.set(row.teamId, slots);
  }
  return byTeam;
}

export async function replaceTeamLineupPlan(input: {
  leagueSeasonId: string;
  teamId: string;
  week: number;
  assignments: Array<{ playerId: string; slotPositionId: string }>;
}): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .delete(teamWeekLineupPlans)
      .where(
        and(
          eq(teamWeekLineupPlans.leagueSeasonId, input.leagueSeasonId),
          eq(teamWeekLineupPlans.teamId, input.teamId),
          eq(teamWeekLineupPlans.week, input.week),
        ),
      );

    if (input.assignments.length === 0) return;

    await tx.insert(teamWeekLineupPlans).values(
      input.assignments.map((row) => ({
        leagueSeasonId: input.leagueSeasonId,
        teamId: input.teamId,
        week: input.week,
        playerId: row.playerId,
        slotPositionId: row.slotPositionId,
        updatedAt: now,
      })),
    );
  });
}

async function deleteDuePlans(input: {
  leagueSeasonId: string;
  teamId: string;
  currentWeek: number;
}) {
  await db
    .delete(teamWeekLineupPlans)
    .where(
      and(
        eq(teamWeekLineupPlans.leagueSeasonId, input.leagueSeasonId),
        eq(teamWeekLineupPlans.teamId, input.teamId),
        lte(teamWeekLineupPlans.week, input.currentWeek),
      ),
    );
}

export async function applyDueLineupPlans(input: {
  leagueSeasonId: string;
  currentWeek: number;
  rosterSlots: RosterSlotConfig[];
  benchSlots: number;
  teamId?: string;
}): Promise<void> {
  const filters = [
    eq(teamWeekLineupPlans.leagueSeasonId, input.leagueSeasonId),
    lte(teamWeekLineupPlans.week, input.currentWeek),
  ];
  if (input.teamId) {
    filters.push(eq(teamWeekLineupPlans.teamId, input.teamId));
  }

  const rows = await db
    .select({
      teamId: teamWeekLineupPlans.teamId,
      playerId: teamWeekLineupPlans.playerId,
      slotPositionId: teamWeekLineupPlans.slotPositionId,
      week: teamWeekLineupPlans.week,
    })
    .from(teamWeekLineupPlans)
    .where(and(...filters));

  if (rows.length === 0) return;

  const latestByTeam = new Map<
    string,
    { week: number; slots: Map<string, string> }
  >();
  for (const row of rows) {
    const current = latestByTeam.get(row.teamId);
    if (!current || row.week > current.week) {
      latestByTeam.set(row.teamId, {
        week: row.week,
        slots: new Map(
          row.slotPositionId ? [[row.playerId, row.slotPositionId]] : [],
        ),
      });
      continue;
    }
    if (row.week === current.week && row.slotPositionId) {
      current.slots.set(row.playerId, row.slotPositionId);
    }
  }

  for (const [teamId, plan] of latestByTeam) {
    const rostered = await listRosteredPlayers(teamId);
    const next = overlayPlanSlots(rostered, plan.slots);
    if (!lineupPlanFitsRoster(next, input.rosterSlots, input.benchSlots)) {
      await deleteDuePlans({
        leagueSeasonId: input.leagueSeasonId,
        teamId,
        currentWeek: input.currentWeek,
      });
      continue;
    }

    const nextById = new Map(
      next.map((player) => [player.id, player.slotPositionId]),
    );
    const persist = rostered.flatMap((row) => {
      const slotPositionId = nextById.get(row.id);
      if (!slotPositionId || row.slotPositionId === slotPositionId) {
        return [];
      }
      return [
        {
          rosterRowId: row.rosterRowId,
          previousSlot: row.slotPositionId,
          slotPositionId,
        },
      ];
    });

    await db.transaction(async (tx) => {
      const now = new Date();
      if (persist.length > 0) {
        await Promise.all(
          persist.map((row) => {
            const leavingTaxi =
              row.previousSlot === "TAXI" && row.slotPositionId !== "TAXI";
            return tx
              .update(rosterPlayers)
              .set({
                slotPositionId: row.slotPositionId,
                ...(leavingTaxi ? { taxiActivated: true } : {}),
                updatedAt: now,
              })
              .where(eq(rosterPlayers.id, row.rosterRowId));
          }),
        );
      }
      await tx
        .delete(teamWeekLineupPlans)
        .where(
          and(
            eq(teamWeekLineupPlans.leagueSeasonId, input.leagueSeasonId),
            eq(teamWeekLineupPlans.teamId, teamId),
            lte(teamWeekLineupPlans.week, input.currentWeek),
          ),
        );
    });
  }
}
