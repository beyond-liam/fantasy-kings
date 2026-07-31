import { eq } from "drizzle-orm";
import { cache } from "react";

import { leagueMembers, profiles } from "@/db/schema";
import { db } from "@/lib/db";
import {
  resolvePresenceStatus,
  type PresenceStatus,
} from "@/lib/presence";
import { getNflState } from "@/lib/sleeper/api";

export type LeaguePresenceMember = {
  userId: string;
  lastSeenAt: string;
  status: PresenceStatus;
};

export type LeaguePresenceSnapshot = {
  nflSeasonType: string;
  members: LeaguePresenceMember[];
  /** Server time used to resolve statuses — useful for client recompute later. */
  resolvedAt: string;
};

export const getLeaguePresence = cache(
  async (leagueId: string): Promise<LeaguePresenceSnapshot> => {
    const [nflState, rows] = await Promise.all([
      getNflState().catch(() => ({ season_type: "off" as const })),
      db
        .select({
          userId: leagueMembers.userId,
          lastSeenAt: profiles.lastSeenAt,
        })
        .from(leagueMembers)
        .innerJoin(profiles, eq(leagueMembers.userId, profiles.id))
        .where(eq(leagueMembers.leagueId, leagueId)),
    ]);

    const nflSeasonType = nflState.season_type;
    const now = new Date();

    return {
      nflSeasonType,
      resolvedAt: now.toISOString(),
      members: rows.map((row) => ({
        userId: row.userId,
        lastSeenAt: row.lastSeenAt.toISOString(),
        status: resolvePresenceStatus({
          lastSeenAt: row.lastSeenAt,
          nflSeasonType,
          now,
        }),
      })),
    };
  },
);
