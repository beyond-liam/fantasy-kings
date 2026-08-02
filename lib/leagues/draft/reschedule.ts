import { eq } from "drizzle-orm";

import { drafts, leagueSeasons } from "@/db/schema";
import { db } from "@/lib/db";

/**
 * When a commissioner moves draft start into the future, unwind a live/paused
 * draft so the room, leagues list, and pick actions stop treating it as underway.
 * Keeps made picks / currentPickIndex so a later start can resume the board.
 */
export async function unwindDraftForFutureStart(input: {
  seasonId: string;
  seasonStatus: string;
  draftStartAt: Date;
  now?: Date;
}): Promise<{ unwound: boolean }> {
  const now = input.now ?? new Date();
  if (input.draftStartAt.getTime() <= now.getTime()) {
    return { unwound: false };
  }

  const [draft] = await db
    .select({
      id: drafts.id,
      status: drafts.status,
      currentPickIndex: drafts.currentPickIndex,
    })
    .from(drafts)
    .where(eq(drafts.leagueSeasonId, input.seasonId))
    .limit(1);

  if (!draft || (draft.status !== "live" && draft.status !== "paused")) {
    return { unwound: false };
  }

  const noPicksYet = draft.currentPickIndex === 0;

  await db
    .update(drafts)
    .set({
      status: "scheduled",
      turnExpiresAt: null,
      pausedAt: null,
      pausedSecondsRemaining: null,
      ...(noPicksYet ? { startedAt: null } : {}),
    })
    .where(eq(drafts.id, draft.id));

  if (input.seasonStatus === "draft" && noPicksYet) {
    await db
      .update(leagueSeasons)
      .set({ status: "recruiting" })
      .where(eq(leagueSeasons.id, input.seasonId));
  }

  return { unwound: true };
}
