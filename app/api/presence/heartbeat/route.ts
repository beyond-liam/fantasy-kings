import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { recordUserHeartbeat } from "@/lib/presence/heartbeat";

/** Proxy coverage is partial, so this route authenticates itself. */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  await recordUserHeartbeat(user.id);

  return NextResponse.json({ success: true });
}
