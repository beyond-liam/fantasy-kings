"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { leagueSeasons, teams } from "@/db/schema";
import { db } from "@/lib/db";
import {
  parsePlayoffSettingsForm,
  resolvePlayoffSettings,
} from "@/lib/leagues/playoff-settings";
import { replaceSeasonMatchups } from "@/lib/leagues/schedule/persist";
import {
  clampPlayEachOtherTimes,
  resolveScheduleSettings,
} from "@/lib/leagues/schedule/settings";
import {
  diffSettingsValues,
  logSettingsUpdated,
} from "@/lib/leagues/settings-activity";

import {
  assertScheduleStillEditable,
  getCommissionerSeason,
  revalidateSettingsPaths,
  type ActionResult,
} from "./_shared";

export async function updateRegularSeasonSchedule(
  slug: string,
  playEachOtherTimes: number,
): Promise<ActionResult> {
  try {
    const result = await getCommissionerSeason(slug);
    if ("error" in result) {
      return { success: false, error: result.error };
    }

    const { season, user } = result;
    const editable = await assertScheduleStillEditable(season.seasonYear);
    if (!editable.success) {
      return editable;
    }

    const times = clampPlayEachOtherTimes(
      playEachOtherTimes,
      season.divisionCount,
    );
    const beforeTimes = resolveScheduleSettings(season.settings.schedule)
      .playEachOtherTimes;

    const seasonTeams = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.leagueSeasonId, season.id))
      .orderBy(asc(teams.createdAt));

    await db.transaction(async (tx) => {
      await tx
        .update(leagueSeasons)
        .set({
          settings: {
            ...season.settings,
            schedule: { playEachOtherTimes: times },
          },
        })
        .where(eq(leagueSeasons.id, season.id));

      if (seasonTeams.length === season.teamCount && season.teamCount >= 2) {
        await replaceSeasonMatchups(tx, {
          leagueSeasonId: season.id,
          teamIds: seasonTeams.map((team) => team.id),
          weekCount: season.regularSeasonEndWeek,
          playEachOtherTimes: times,
        });
      }
    });

    await logSettingsUpdated({
      leagueSeasonId: season.id,
      actorUserId: user.id,
      section: "schedule",
      label: "Regular-season schedule",
      changes: diffSettingsValues(
        { playEachOtherTimes: beforeTimes },
        { playEachOtherTimes: times },
        [{ path: "playEachOtherTimes", label: "Play each other times" }],
      ),
    });

    revalidateSettingsPaths(slug);

    return { success: true };
  } catch (error) {
    console.error("updateRegularSeasonSchedule failed", error);
    return {
      success: false,
      error: "Could not save schedule settings. Try again.",
    };
  }
}

export async function regenerateRegularSeasonSchedule(
  slug: string,
): Promise<ActionResult> {
  try {
    const result = await getCommissionerSeason(slug);
    if ("error" in result) {
      return { success: false, error: result.error };
    }

    const { season } = result;
    const editable = await assertScheduleStillEditable(season.seasonYear);
    if (!editable.success) {
      return editable;
    }

    const seasonTeams = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.leagueSeasonId, season.id))
      .orderBy(asc(teams.createdAt));

    if (seasonTeams.length !== season.teamCount || season.teamCount < 2) {
      return {
        success: false,
        error: "The league must be full before a schedule can be generated.",
      };
    }

    const schedule = resolveScheduleSettings(season.settings.schedule);
    const times = clampPlayEachOtherTimes(
      schedule.playEachOtherTimes,
      season.divisionCount,
    );

    await replaceSeasonMatchups(db, {
      leagueSeasonId: season.id,
      teamIds: seasonTeams.map((team) => team.id),
      weekCount: season.regularSeasonEndWeek,
      playEachOtherTimes: times,
    });

    revalidateSettingsPaths(slug);

    return { success: true };
  } catch (error) {
    console.error("regenerateRegularSeasonSchedule failed", error);
    return {
      success: false,
      error: "Could not regenerate schedule. Try again.",
    };
  }
}

export async function updatePlayoffSettings(
  slug: string,
  input: {
    enabled: boolean;
    playoffTeamCount: number;
    championshipWeek: number;
    reSeedAfterEachRound: boolean;
    twoWeekChampionship: boolean;
  },
): Promise<ActionResult> {
  try {
    const result = await getCommissionerSeason(slug);
    if ("error" in result) {
      return { success: false, error: result.error };
    }

    const { season, user } = result;
    const editable = await assertScheduleStillEditable(season.seasonYear);
    if (!editable.success) {
      return editable;
    }

    const parsed = parsePlayoffSettingsForm({
      ...input,
      teamCount: season.teamCount,
    });
    if (!parsed.ok) {
      return { success: false, error: parsed.error };
    }

    const { values, regularSeasonEndWeek } = parsed;
    const beforePlayoffs = resolvePlayoffSettings(season.settings.playoffs);
    const before = {
      enabled: beforePlayoffs.enabled,
      playoffTeamCount: season.playoffTeamCount,
      championshipWeek: season.championshipWeek,
      reSeedAfterEachRound: beforePlayoffs.reSeedAfterEachRound,
      twoWeekChampionship: beforePlayoffs.twoWeekChampionship,
    };
    const after = {
      enabled: values.enabled,
      playoffTeamCount: values.playoffTeamCount,
      championshipWeek: values.championshipWeek,
      reSeedAfterEachRound: values.reSeedAfterEachRound,
      twoWeekChampionship: values.twoWeekChampionship,
    };
    const schedule = resolveScheduleSettings(season.settings.schedule);
    const times = clampPlayEachOtherTimes(
      schedule.playEachOtherTimes,
      season.divisionCount,
    );

    const seasonTeams = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.leagueSeasonId, season.id))
      .orderBy(asc(teams.createdAt));

    const nextTradeDeadline =
      season.tradesEnabled && season.tradeDeadlineWeek != null
        ? Math.min(season.tradeDeadlineWeek, regularSeasonEndWeek)
        : season.tradeDeadlineWeek;

    await db.transaction(async (tx) => {
      await tx
        .update(leagueSeasons)
        .set({
          playoffTeamCount: values.playoffTeamCount,
          championshipWeek: values.championshipWeek,
          regularSeasonEndWeek,
          tradeDeadlineWeek: season.tradesEnabled ? nextTradeDeadline : null,
          settings: {
            ...season.settings,
            playoffs: {
              enabled: values.enabled,
              reSeedAfterEachRound: values.reSeedAfterEachRound,
              twoWeekChampionship: values.twoWeekChampionship,
            },
          },
        })
        .where(eq(leagueSeasons.id, season.id));

      if (seasonTeams.length === season.teamCount && season.teamCount >= 2) {
        await replaceSeasonMatchups(tx, {
          leagueSeasonId: season.id,
          teamIds: seasonTeams.map((team) => team.id),
          weekCount: regularSeasonEndWeek,
          playEachOtherTimes: times,
        });
      }
    });

    await logSettingsUpdated({
      leagueSeasonId: season.id,
      actorUserId: user.id,
      section: "playoffs",
      label: "Playoffs",
      changes: diffSettingsValues(before, after, [
        { path: "enabled", label: "Playoffs enabled" },
        { path: "playoffTeamCount", label: "Playoff teams" },
        { path: "championshipWeek", label: "Championship week" },
        { path: "reSeedAfterEachRound", label: "Re-seed after each round" },
        { path: "twoWeekChampionship", label: "Two-week championship" },
      ]),
    });

    revalidateSettingsPaths(slug);
    revalidatePath(`/league/${slug}/settings/transactions`);

    return { success: true };
  } catch (error) {
    console.error("updatePlayoffSettings failed", error);
    return {
      success: false,
      error: "Could not save playoff settings. Try again.",
    };
  }
}
