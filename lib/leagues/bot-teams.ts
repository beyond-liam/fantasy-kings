import "server-only";

import { eq } from "drizzle-orm";

import { profiles } from "@/db/schema";
import { db } from "@/lib/db";
import { isBotManagerDisplayName } from "@/lib/leagues/league-size";

/** True for placeholder owners created by fillEmptySlotsWithBotTeams. */
export async function isBotManagerUserId(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) {
    return false;
  }

  const [profile] = await db
    .select({ displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  return isBotManagerDisplayName(profile?.displayName);
}
