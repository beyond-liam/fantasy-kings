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
  | "member_removed"
  | "draft_pick"
  | "draft_pick_reverted"
  | "keepers_set";

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
  "draft_pick",
  "draft_pick_reverted",
  "keepers_set",
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
  /** Override default now() — used to order companion rows (drop / IR / taxi). */
  createdAt?: Date;
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
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
  });
}

/** Activity when an acquisition lands directly on IR or Taxi. */
export function reservePlacementFromAcquisition(input: {
  slotPositionId: string | null | undefined;
  teamName: string;
  playerName: string;
}): { type: "ir_added" | "taxi_added"; summary: string } | null {
  if (input.slotPositionId === "IR") {
    return {
      type: "ir_added",
      summary: `${input.teamName} added ${input.playerName} to IR`,
    };
  }
  if (input.slotPositionId === "TAXI") {
    return {
      type: "taxi_added",
      summary: `${input.teamName} moved ${input.playerName} to their taxi squad`,
    };
  }
  return null;
}

export async function logReservePlacementFromAcquisition(input: {
  leagueSeasonId: string;
  teamId: string;
  actorUserId?: string | null;
  playerId: string;
  slotPositionId: string | null | undefined;
  teamName: string;
  playerName: string;
  claimId?: string | null;
  createdAt?: Date;
}) {
  const event = reservePlacementFromAcquisition(input);
  if (!event) {
    return;
  }

  await logLeagueActivity({
    leagueSeasonId: input.leagueSeasonId,
    type: event.type,
    teamId: input.teamId,
    actorUserId: input.actorUserId,
    playerId: input.playerId,
    claimId: input.claimId,
    summary: event.summary,
    metadata: {
      playerName: input.playerName,
      teamName: input.teamName,
    },
    createdAt: input.createdAt,
  });
}
