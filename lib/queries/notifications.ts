import { and, count, desc, eq, isNull } from "drizzle-orm";
import { cache } from "react";

import { notifications } from "@/db/schema";
import { db } from "@/lib/db";

export type NotificationListItem = {
  id: string;
  type: (typeof notifications.$inferSelect)["type"];
  title: string;
  body: string;
  href: string;
  readAt: Date | null;
  createdAt: Date;
};

export const getUserNotifications = cache(
  async (userId: string, limit = 30): Promise<NotificationListItem[]> => {
    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        href: notifications.href,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientUserId, userId),
          isNull(notifications.clearedAt),
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    return rows;
  },
);

export const getUnreadNotificationCount = cache(async (userId: string) => {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, userId),
        isNull(notifications.clearedAt),
        isNull(notifications.readAt),
      ),
    );

  return Number(row?.value ?? 0);
});
