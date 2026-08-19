import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import {
  getUnreadNotificationCount,
  getUserNotifications,
} from "@/lib/queries/notifications";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [items, unreadCount] = await Promise.all([
    getUserNotifications(user.id),
    getUnreadNotificationCount(user.id),
  ]);

  return NextResponse.json({ items, unreadCount });
}
