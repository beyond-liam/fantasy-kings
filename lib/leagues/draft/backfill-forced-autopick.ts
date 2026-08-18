import { asc, eq } from "drizzle-orm";

import { draftPicks, drafts, leagueSeasons, teams } from "@/db/schema";
import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { db } from "@/lib/db";
import {
  buildDraftSchedule,
  getDraftRounds,
} from "@/lib/leagues/draft/board";
import { expiredPickStreakFromSources } from "@/lib/leagues/draft/expired-pick-streak";
import { ensureDraftTurnClock } from "@/lib/leagues/draft/ensure-turn-clock";
import { resolveDraftSettings } from "@/lib/leagues/draft-settings";

export type ForcedAutopickBackfillResult = {
  updated: number;
  forcedTeamIds: string[];
};

/**
 * Apply consecutive trailing autopicks from the board onto team Autopick
 * state. Historical autopicks count as missed clocks.
 */
export async function backfillForcedAutopickFromDraftPicks(input: {
  leagueSeasonId: string;
  draftId: string;
}): Promise<ForcedAutopickBackfillResult> {
  const picks = await db
    .select({
      teamId: draftPicks.teamId,
      source: draftPicks.source,
    })
    .from(draftPicks)
    .where(eq(draftPicks.draftId, input.draftId))
    .orderBy(asc(draftPicks.overall));

  const sourcesByTeam = new Map<
    string,
    Array<"manual" | "commissioner" | "autopick">
  >();
  for (const pick of picks) {
    const list = sourcesByTeam.get(pick.teamId) ?? [];
    list.push(pick.source);
    sourcesByTeam.set(pick.teamId, list);
  }

  const seasonTeams = await db
    .select({
      id: teams.id,
      consecutiveExpiredPicks: teams.consecutiveExpiredPicks,
      forcedAutoPick: teams.forcedAutoPick,
      autoPickEnabled: teams.autoPickEnabled,
    })
    .from(teams)
    .where(eq(teams.leagueSeasonId, input.leagueSeasonId));

  const forcedTeamIds: string[] = [];
  let updated = 0;

  for (const team of seasonTeams) {
    const streak = expiredPickStreakFromSources(
      sourcesByTeam.get(team.id) ?? [],
      true,
    );
    const nextForced = Boolean(streak.forcedAutoPick);
    const nextConsecutive = streak.consecutiveExpiredPicks;
    const nextAutoPick =
      streak.autoPickEnabled !== undefined
        ? streak.autoPickEnabled
        : team.autoPickEnabled;

    if (
      team.forcedAutoPick === nextForced &&
      team.consecutiveExpiredPicks === nextConsecutive &&
      team.autoPickEnabled === nextAutoPick
    ) {
      if (nextForced) {
        forcedTeamIds.push(team.id);
      }
      continue;
    }

    await db
      .update(teams)
      .set({
        consecutiveExpiredPicks: nextConsecutive,
        forcedAutoPick: nextForced,
        autoPickEnabled: nextAutoPick,
      })
      .where(eq(teams.id, team.id));
    updated += 1;
    if (nextForced) {
      forcedTeamIds.push(team.id);
    }
  }

  if (forcedTeamIds.length > 0) {
    await expireClockIfForcedTeamOnClock({
      leagueSeasonId: input.leagueSeasonId,
      forcedTeamIds,
    });
  }

  return { updated, forcedTeamIds };
}

/** One-shot: skip if already applied, or if the commissioner setting is off. */
export async function ensureForcedAutopickStreakBackfill(input: {
  leagueSeasonId: string;
  draftId: string;
  settings: LeagueSeasonSettings;
}): Promise<ForcedAutopickBackfillResult | null> {
  const draft = resolveDraftSettings(input.settings.draft);
  if (!draft.forceAutopickAfterTwoExpires) {
    return null;
  }
  if (draft.forceAutopickStreaksBackfilled) {
    return null;
  }

  const result = await backfillForcedAutopickFromDraftPicks({
    leagueSeasonId: input.leagueSeasonId,
    draftId: input.draftId,
  });

  await db
    .update(leagueSeasons)
    .set({
      settings: {
        ...input.settings,
        draft: {
          ...draft,
          forceAutopickStreaksBackfilled: true,
        },
      },
    })
    .where(eq(leagueSeasons.id, input.leagueSeasonId));

  return result;
}

async function expireClockIfForcedTeamOnClock(input: {
  leagueSeasonId: string;
  forcedTeamIds: string[];
}): Promise<void> {
  const forced = new Set(input.forcedTeamIds);
  const [season] = await db
    .select({
      settings: leagueSeasons.settings,
      benchSlots: leagueSeasons.benchSlots,
      pickTimeLimitSeconds: leagueSeasons.pickTimeLimitSeconds,
    })
    .from(leagueSeasons)
    .where(eq(leagueSeasons.id, input.leagueSeasonId))
    .limit(1);
  const [draft] = await db
    .select({
      id: drafts.id,
      status: drafts.status,
      currentPickIndex: drafts.currentPickIndex,
      turnExpiresAt: drafts.turnExpiresAt,
      pausedSecondsRemaining: drafts.pausedSecondsRemaining,
    })
    .from(drafts)
    .where(eq(drafts.leagueSeasonId, input.leagueSeasonId))
    .limit(1);

  if (
    !season ||
    !draft ||
    (draft.status !== "live" && draft.status !== "paused")
  ) {
    return;
  }

  const seasonTeams = await db
    .select({
      id: teams.id,
      name: teams.name,
      draftSlot: teams.draftSlot,
    })
    .from(teams)
    .where(eq(teams.leagueSeasonId, input.leagueSeasonId));

  const teamsWithSlots = seasonTeams
    .filter((row) => row.draftSlot != null)
    .map((row) => ({
      id: row.id,
      name: row.name,
      draftSlot: row.draftSlot as number,
    }));
  const schedule = buildDraftSchedule({
    teams: teamsWithSlots,
    rounds: getDraftRounds(season.settings.rosterSlots, season.benchSlots),
    style: resolveDraftSettings(season.settings.draft).style,
  });
  const onClock = schedule[draft.currentPickIndex];
  if (!onClock || !forced.has(onClock.teamId)) {
    return;
  }

  await ensureDraftTurnClock({
    draft,
    pickTimeLimitSeconds: season.pickTimeLimitSeconds,
    clockExempt: true,
  });
}
