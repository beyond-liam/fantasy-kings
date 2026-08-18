import { eq, inArray } from "drizzle-orm";

import { drafts, leagueSeasons, leagues, teams } from "@/db/schema";
import { db } from "@/lib/db";
import { computeTurnExpiresAt } from "@/lib/leagues/draft/clock";
import { draftRoundsForSeason } from "@/lib/leagues/draft/board";
import { resolveDynastySettings, withKeepersLocked } from "@/lib/leagues/dynasty-settings";
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

  const [season] = await db
    .select()
    .from(leagueSeasons)
    .where(eq(leagueSeasons.id, seasonId))
    .limit(1);

  let seasonSettings = season?.settings;

  if (!resumed && season?.leagueType === "dynasty") {
    const [league] = await db
      .select({ publicId: leagues.publicId })
      .from(leagues)
      .where(eq(leagues.id, season.leagueId))
      .limit(1);
    if (league) {
      const { clearNonKeepersForSeason } = await import(
        "@/lib/leagues/keepers/process"
      );
      const cleared = await clearNonKeepersForSeason({
        leagueSeasonId: seasonId,
        leaguePublicId: league.publicId,
        source: "draft_start",
        now,
      });
      if (cleared.ok) {
        seasonSettings = {
          ...season.settings,
          dynasty: cleared.dynasty,
        };
      }
    }
  }

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
        pausedByWindow: false,
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
        pausedByWindow: false,
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
      pausedByWindow: false,
    });
  }

  if (seasonStatus !== "draft") {
    await db
      .update(leagueSeasons)
      .set({ status: "draft" })
      .where(eq(leagueSeasons.id, seasonId));
  }

  const rounds =
    season && seasonSettings
      ? draftRoundsForSeason({
          settings: seasonSettings,
          benchSlots: season.benchSlots,
        })
      : 1;
  if (!resumed && rounds <= 0 && season && seasonSettings) {
    const draftRow = await getDraftBySeasonId(seasonId);
    if (draftRow) {
      await db
        .update(drafts)
        .set({
          status: "complete",
          completedAt: now,
          turnExpiresAt: null,
          pausedAt: null,
          pausedSecondsRemaining: null,
        })
        .where(eq(drafts.id, draftRow.id));
    }
    const dynasty = resolveDynastySettings(seasonSettings.dynasty);
    await db
      .update(leagueSeasons)
      .set({
        status: "active",
        ...(dynasty.keepersLocked
          ? {
              settings: {
                ...seasonSettings,
                dynasty: withKeepersLocked(dynasty, false),
              },
            }
          : {}),
      })
      .where(eq(leagueSeasons.id, seasonId));
  }

  return { ok: true, resumed };
}
