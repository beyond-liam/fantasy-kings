import { eq } from "drizzle-orm";

import { leagues, leagueSeasons, notifications } from "@/db/schema";
import type { NotificationType } from "@/db/schema/notifications";
import { db } from "@/lib/db";

export type CreateNotificationInput = {
  recipientUserId: string;
  leagueSeasonId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  tradeId?: string | null;
  claimId?: string | null;
  playerId?: string | null;
  matchupId?: string | null;
};

export async function createNotifications(rows: CreateNotificationInput[]) {
  const filtered = rows.filter(
    (row) => row.recipientUserId.trim().length > 0 && row.href.trim().length > 0,
  );
  if (filtered.length === 0) {
    return;
  }

  await db.insert(notifications).values(
    filtered.map((row) => ({
      recipientUserId: row.recipientUserId,
      leagueSeasonId: row.leagueSeasonId ?? null,
      type: row.type,
      title: row.title,
      body: row.body,
      href: row.href,
      tradeId: row.tradeId ?? null,
      claimId: row.claimId ?? null,
      playerId: row.playerId ?? null,
      matchupId: row.matchupId ?? null,
    })),
  );
}

export async function createNotification(row: CreateNotificationInput) {
  await createNotifications([row]);
}

export async function getLeaguePublicIdForSeason(
  leagueSeasonId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ publicId: leagues.publicId })
    .from(leagueSeasons)
    .innerJoin(leagues, eq(leagueSeasons.leagueId, leagues.id))
    .where(eq(leagueSeasons.id, leagueSeasonId))
    .limit(1);

  return row?.publicId ?? null;
}

export function tradesHref(leaguePublicId: string) {
  return `/league/${leaguePublicId}/trades`;
}

export function transactionsHref(leaguePublicId: string) {
  return `/league/${leaguePublicId}/team?tab=transactions`;
}

export function rosterHref(leaguePublicId: string) {
  return `/league/${leaguePublicId}/team`;
}

export function matchupHref(leaguePublicId: string, matchupPublicId: string) {
  return `/league/${leaguePublicId}/scores/${matchupPublicId}`;
}
