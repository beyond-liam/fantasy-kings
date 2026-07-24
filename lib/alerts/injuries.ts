import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { leagues, leagueSeasons, rosterPlayers, teams } from "@/db/schema";
import { db } from "@/lib/db";
import {
  createNotifications,
  rosterHref,
  type CreateNotificationInput,
} from "@/lib/notifications/create";
import { getInjuryIndicator } from "@/lib/players/injury";

/**
 * After player injury_status updates, notify owners of rostered players whose
 * designation newly looks like Out/Questionable (etc.).
 */
export async function announceRosterInjuryChanges(input: {
  changes: Array<{
    playerId: string;
    fullName: string;
    previousStatus: string | null;
    nextStatus: string | null;
  }>;
}) {
  const meaningful = input.changes.filter((change) => {
    const prev = getInjuryIndicator(change.previousStatus);
    const next = getInjuryIndicator(change.nextStatus);
    if (!next) return false;
    if (prev?.status === next.status && prev?.tone === next.tone) return false;
    return true;
  });
  if (meaningful.length === 0) return;

  const playerIds = meaningful.map((change) => change.playerId);
  const rostered = await db
    .select({
      playerId: rosterPlayers.playerId,
      teamId: teams.id,
      userId: teams.userId,
      leagueSeasonId: teams.leagueSeasonId,
      leaguePublicId: leagues.publicId,
    })
    .from(rosterPlayers)
    .innerJoin(teams, eq(rosterPlayers.teamId, teams.id))
    .innerJoin(leagueSeasons, eq(teams.leagueSeasonId, leagueSeasons.id))
    .innerJoin(leagues, eq(leagueSeasons.leagueId, leagues.id))
    .where(
      and(
        inArray(rosterPlayers.playerId, playerIds),
        eq(rosterPlayers.status, "rostered"),
      ),
    );

  const byPlayer = new Map(meaningful.map((c) => [c.playerId, c]));
  const rows: CreateNotificationInput[] = [];

  for (const row of rostered) {
    if (!row.userId) continue;
    const change = byPlayer.get(row.playerId);
    if (!change) continue;
    const indicator = getInjuryIndicator(change.nextStatus);
    if (!indicator) continue;
    rows.push({
      recipientUserId: row.userId,
      leagueSeasonId: row.leagueSeasonId,
      type: "player_status",
      title: `${change.fullName}: ${indicator.label}`,
      body: `${change.fullName} is now listed as ${indicator.label}.`,
      href: rosterHref(row.leaguePublicId),
      playerId: change.playerId,
    });
  }

  await createNotifications(rows);
}
