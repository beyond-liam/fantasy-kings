import { inArray } from "drizzle-orm";

import { teams } from "@/db/schema";
import { db } from "@/lib/db";
import {
  createNotifications,
  tradesHref,
  type CreateNotificationInput,
} from "@/lib/notifications/create";
import type { NotificationType } from "@/db/schema/notifications";

export async function getTeamOwnerUserIds(teamIds: string[]) {
  const unique = [...new Set(teamIds.filter(Boolean))];
  if (unique.length === 0) {
    return new Map<string, string>();
  }

  const rows = await db
    .select({ id: teams.id, userId: teams.userId })
    .from(teams)
    .where(inArray(teams.id, unique));

  return new Map(
    rows
      .filter((row): row is { id: string; userId: string } => Boolean(row.userId))
      .map((row) => [row.id, row.userId]),
  );
}

export async function notifyUsers(input: {
  userIds: Array<string | null | undefined>;
  excludeUserId?: string | null;
  leagueSeasonId: string;
  leaguePublicId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  tradeId?: string | null;
  claimId?: string | null;
  playerId?: string | null;
}) {
  const exclude = input.excludeUserId ?? null;
  const recipients = [
    ...new Set(
      input.userIds.filter(
        (id): id is string => Boolean(id) && id !== exclude,
      ),
    ),
  ];
  if (recipients.length === 0) {
    return;
  }

  const href = input.href ?? tradesHref(input.leaguePublicId);
  const rows: CreateNotificationInput[] = recipients.map((recipientUserId) => ({
    recipientUserId,
    leagueSeasonId: input.leagueSeasonId,
    type: input.type,
    title: input.title,
    body: input.body,
    href,
    tradeId: input.tradeId ?? null,
    claimId: input.claimId ?? null,
    playerId: input.playerId ?? null,
  }));

  await createNotifications(rows);
}
