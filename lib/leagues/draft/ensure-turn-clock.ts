import { eq } from "drizzle-orm";

import { drafts } from "@/db/schema";
import { db } from "@/lib/db";
import { computeTurnExpiresAt } from "@/lib/leagues/draft/clock";

type DraftClockRow = {
  id: string;
  status: "scheduled" | "live" | "paused" | "complete";
  turnExpiresAt: Date | null;
  pausedSecondsRemaining: number | null;
};

/**
 * When a timed draft is live/paused without a clock value (e.g. limit enabled
 * mid-turn), start a full pick window from now / freeze the full allotment.
 */
export async function ensureDraftTurnClock(input: {
  draft: DraftClockRow;
  pickTimeLimitSeconds: number;
  now?: Date;
}): Promise<DraftClockRow> {
  const { draft, pickTimeLimitSeconds } = input;
  const now = input.now ?? new Date();

  if (pickTimeLimitSeconds <= 0) {
    if (draft.turnExpiresAt == null && draft.pausedSecondsRemaining == null) {
      return draft;
    }
    await db
      .update(drafts)
      .set({
        turnExpiresAt: null,
        pausedSecondsRemaining:
          draft.status === "paused" ? null : draft.pausedSecondsRemaining,
      })
      .where(eq(drafts.id, draft.id));
    return {
      ...draft,
      turnExpiresAt: null,
      pausedSecondsRemaining:
        draft.status === "paused" ? null : draft.pausedSecondsRemaining,
    };
  }

  if (draft.status === "live" && draft.turnExpiresAt == null) {
    const turnExpiresAt = computeTurnExpiresAt(now, pickTimeLimitSeconds);
    await db
      .update(drafts)
      .set({ turnExpiresAt, pausedSecondsRemaining: null })
      .where(eq(drafts.id, draft.id));
    return {
      ...draft,
      turnExpiresAt,
      pausedSecondsRemaining: null,
    };
  }

  if (
    draft.status === "paused" &&
    (draft.pausedSecondsRemaining == null || draft.pausedSecondsRemaining <= 0)
  ) {
    await db
      .update(drafts)
      .set({
        pausedSecondsRemaining: pickTimeLimitSeconds,
        turnExpiresAt: null,
      })
      .where(eq(drafts.id, draft.id));
    return {
      ...draft,
      turnExpiresAt: null,
      pausedSecondsRemaining: pickTimeLimitSeconds,
    };
  }

  return draft;
}
