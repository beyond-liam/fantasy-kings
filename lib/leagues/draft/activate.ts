import { eq, inArray } from "drizzle-orm";

import { drafts, leagueSeasons, teams } from "@/db/schema";
import { db } from "@/lib/db";
import { computeTurnExpiresAt } from "@/lib/leagues/draft/clock";
import { getDraftBySeasonId } from "@/lib/queries/draft";

type SeasonTeamSlot = {
  id: string;
  draftSlot: number | null;
  userId?: string | null;
};

type ActivateDraftResult =
  | { ok: true; resumed: boolean }
  | { ok: false; error: string };

/** Assign ascending draft slots to any teams missing one. */
export async function ensureTeamDraftSlots(
  seasonTeams: SeasonTeamSlot[],
): Promise<void> {
  const usedSlots = new Set(
    seasonTeams
      .map((team) => team.draftSlot)
      .filter((slot): slot is number => slot != null),
  );
  let nextSlot = 1;
  for (const team of seasonTeams) {
    if (team.draftSlot != null) {
      continue;
    }
    while (usedSlots.has(nextSlot)) {
      nextSlot += 1;
    }
    await db
      .update(teams)
      .set({ draftSlot: nextSlot })
      .where(eq(teams.id, team.id));
    usedSlots.add(nextSlot);
    nextSlot += 1;
  }
}

/** Open (unclaimed) slots always autopick so the board can advance. */
export async function ensureOpenSlotAutopick(
  seasonTeams: SeasonTeamSlot[],
): Promise<void> {
  const openIds = seasonTeams
    .filter((team) => team.userId == null)
    .map((team) => team.id);
  if (openIds.length === 0) {
    return;
  }
  await db
    .update(teams)
    .set({ autoPickEnabled: true })
    .where(inArray(teams.id, openIds));
}

/**
 * Put a draft live (or resume from paused). Does not enforce commissioner /
 * schedule gates — callers own authorization.
 */
export async function activateDraftLive(input: {
  seasonId: string;
  seasonStatus: string;
  seasonTeams: SeasonTeamSlot[];
  pickTimeLimitSeconds: number;
  /** When false, refuse to resume a paused draft (auto-start path). */
  allowResume?: boolean;
}): Promise<ActivateDraftResult> {
  const {
    seasonId,
    seasonStatus,
    seasonTeams,
    pickTimeLimitSeconds,
    allowResume = true,
  } = input;

  if (seasonTeams.length === 0) {
    return {
      ok: false,
      error: "Add at least one team before starting the draft.",
    };
  }

  if (seasonStatus === "active") {
    return { ok: false, error: "Season is already active." };
  }

  const existing = await getDraftBySeasonId(seasonId);
  if (existing?.status === "complete") {
    return { ok: false, error: "Draft is already complete." };
  }
  if (existing?.status === "live") {
    return { ok: false, error: "Draft is already live." };
  }
  if (existing?.status === "paused" && !allowResume) {
    return { ok: false, error: "Draft is paused." };
  }

  await ensureTeamDraftSlots(seasonTeams);
  await ensureOpenSlotAutopick(seasonTeams);

  const now = new Date();
  const resumed = existing?.status === "paused";

  if (resumed && existing) {
    const remaining =
      existing.pausedSecondsRemaining ??
      (pickTimeLimitSeconds > 0 ? pickTimeLimitSeconds : null);
    await db
      .update(drafts)
      .set({
        status: "live",
        pausedAt: null,
        pausedSecondsRemaining: null,
        turnExpiresAt:
          remaining != null && remaining > 0
            ? computeTurnExpiresAt(now, remaining)
            : null,
      })
      .where(eq(drafts.id, existing.id));
  } else if (existing) {
    await db
      .update(drafts)
      .set({
        status: "live",
        startedAt: existing.startedAt ?? now,
        pausedAt: null,
        pausedSecondsRemaining: null,
        turnExpiresAt: computeTurnExpiresAt(now, pickTimeLimitSeconds),
      })
      .where(eq(drafts.id, existing.id));
  } else {
    await db.insert(drafts).values({
      leagueSeasonId: seasonId,
      status: "live",
      currentPickIndex: 0,
      startedAt: now,
      turnExpiresAt: computeTurnExpiresAt(now, pickTimeLimitSeconds),
    });
  }

  if (seasonStatus !== "draft") {
    await db
      .update(leagueSeasons)
      .set({ status: "draft" })
      .where(eq(leagueSeasons.id, seasonId));
  }

  return { ok: true, resumed };
}
