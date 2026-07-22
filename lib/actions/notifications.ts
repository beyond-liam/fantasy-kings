"use server";

import { and, eq, isNull } from "drizzle-orm";

import { notifications } from "@/db/schema";
import { requireSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  getUnreadNotificationCount,
  getUserNotifications,
  type NotificationListItem,
} from "@/lib/queries/notifications";

export type NotificationsPayload = {
  items: NotificationListItem[];
  unreadCount: number;
};

export async function getSessionNotifications(): Promise<NotificationsPayload | null> {
  try {
    const user = await requireSessionUser();
    const [items, unreadCount] = await Promise.all([
      getUserNotifications(user.id),
      getUnreadNotificationCount(user.id),
    ]);
    return { items, unreadCount };
  } catch {
    return null;
  }
}

export async function markNotificationRead(
  notificationId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!notificationId) {
    return { success: false, error: "Missing notification." };
  }

  try {
    const user = await requireSessionUser();
    const now = new Date();
    await db
      .update(notifications)
      .set({ readAt: now })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.recipientUserId, user.id),
          isNull(notifications.clearedAt),
          isNull(notifications.readAt),
        ),
      );
    return { success: true };
  } catch {
    return { success: false, error: "Could not mark notification as read." };
  }
}

export async function clearAllNotifications(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireSessionUser();
    const now = new Date();
    await db
      .update(notifications)
      .set({
        clearedAt: now,
        readAt: now,
      })
      .where(
        and(
          eq(notifications.recipientUserId, user.id),
          isNull(notifications.clearedAt),
        ),
      );
    return { success: true };
  } catch {
    return { success: false, error: "Could not clear notifications." };
  }
}
