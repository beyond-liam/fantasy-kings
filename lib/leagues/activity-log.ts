import { leagueActivity } from "@/db/schema";
import type { LeagueActivityMetadata } from "@/db/schema/league-activity";
import { db } from "@/lib/db";

/**
 * Types shown on the public league Activity feed.
 * Negotiation noise (proposals, private rejects, failed claims) stays out.
 */
export type FeedActivityType =
  | "player_added"
  | "player_dropped"
  | "ir_added"
  | "ir_removed"
  | "taxi_added"
  | "taxi_removed"
  | "waiver_awarded"
  | "trade_accepted"
  | "trade_completed"
  | "trade_vetoed"
  | "trade_cancelled"
  | "settings_updated"
  | "score_corrected"
  | "member_removed";

export const FEED_ACTIVITY_TYPES = [
  "player_added",
  "player_dropped",
  "ir_added",
  "ir_removed",
  "taxi_added",
  "taxi_removed",
  "waiver_awarded",
  "trade_accepted",
  "trade_completed",
  "trade_vetoed",
  "trade_cancelled",
  "settings_updated",
  "score_corrected",
  "member_removed",
] as const satisfies readonly FeedActivityType[];

type LogLeagueActivityInput = {
  leagueSeasonId: string;
  type:
    | FeedActivityType
    | "waiver_failed"
    | "trade_proposed"
    | "trade_rejected";
  summary: string;
  teamId?: string | null;
  actorUserId?: string | null;
  playerId?: string | null;
  relatedPlayerId?: string | null;
  claimId?: string | null;
  tradeId?: string | null;
  metadata?: LeagueActivityMetadata;
};

export async function logLeagueActivity(input: LogLeagueActivityInput) {
  await db.insert(leagueActivity).values({
    leagueSeasonId: input.leagueSeasonId,
    type: input.type,
    summary: input.summary,
    teamId: input.teamId ?? null,
    actorUserId: input.actorUserId ?? null,
    playerId: input.playerId ?? null,
    relatedPlayerId: input.relatedPlayerId ?? null,
    claimId: input.claimId ?? null,
    tradeId: input.tradeId ?? null,
    metadata: input.metadata ?? {},
  });
}
