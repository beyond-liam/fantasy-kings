import { and, eq, lt, sql } from "drizzle-orm";

import { profiles } from "@/db/schema";
import { db } from "@/lib/db";

export async function getProfileLastSeenAt(
  userId: string,
): Promise<Date | null> {
  const [row] = await db
    .select({ lastSeenAt: profiles.lastSeenAt })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return row?.lastSeenAt ?? null;
}

/**
 * Skip the write while the stored value is this fresh. Keeps heartbeat traffic
 * off the single pooled connection without coarsening the online window.
 */
export const HEARTBEAT_WRITE_THROTTLE_SECONDS = 60;

/** Records app activity using server time. Returns true when a row was written. */
export async function recordUserHeartbeat(userId: string): Promise<boolean> {
  const updated = await db
    .update(profiles)
    .set({ lastSeenAt: sql`now()` })
    .where(
      and(
        eq(profiles.id, userId),
        lt(
          profiles.lastSeenAt,
          sql`now() - make_interval(secs => ${HEARTBEAT_WRITE_THROTTLE_SECONDS})`,
        ),
      ),
    )
    .returning({ id: profiles.id });

  return updated.length > 0;
}
