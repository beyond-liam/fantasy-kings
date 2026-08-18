import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { releaseForcedAutopickForUser } from "@/lib/leagues/draft/forced-autopick";
import { isUserOnline } from "@/lib/presence";
import {
  getProfileLastSeenAt,
  recordUserHeartbeat,
} from "@/lib/presence/heartbeat";

/** Proxy coverage is partial, so this route authenticates itself. */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  const lastSeenAt = await getProfileLastSeenAt(user.id);
  const wasOffline = !isUserOnline(lastSeenAt);
  if (wasOffline) {
    await releaseForcedAutopickForUser(user.id);
  }
  await recordUserHeartbeat(user.id);

  return NextResponse.json({ success: true });
}
