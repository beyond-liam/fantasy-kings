"use server";

import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  divisions,
  leagueMembers,
  leagueSeasons,
  profiles,
  teams,
} from "@/db/schema";
import { db } from "@/lib/db";
import { areDivisionsBalanced } from "@/lib/leagues/membership";
import { nextBotTeamName } from "@/lib/leagues/league-size";
import { clampPlayoffTeamCount, resolvePlayoffSettings } from "@/lib/leagues/playoff-settings";
import { replaceSeasonMatchups } from "@/lib/leagues/schedule/persist";
import { clampPlayEachOtherTimes, resolveScheduleSettings } from "@/lib/leagues/schedule/settings";
import { TEAM_COUNT_MAX, TEAM_COUNT_MIN } from "@/lib/leagues/season-calendar";
import { allocateUniqueTeamSlug } from "@/lib/leagues/utils";
import { generatePublicId } from "@/lib/leagues/public-id";

import {
  getCommissionerSeason,
  revalidateSettingsPaths,
  type ActionResult,
} from "./_shared";

export type OpenFreeAgencyMode = "draft_later" | "no_draft";

/**
 * Fill vacant league slots with placeholder bot owners + teams.
 * For draft testing — bots are real DB rows (profiles, members, teams).
 */
export async function fillEmptySlotsWithBotTeams(
  slug: string,
): Promise<ActionResult> {
  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season, league } = result;

  const existingTeams = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      draftSlot: teams.draftSlot,
      waiverPriority: teams.waiverPriority,
      userId: teams.userId,
    })
    .from(teams)
    .where(eq(teams.leagueSeasonId, season.id))
    .orderBy(asc(teams.createdAt));

  const openTeams = existingTeams.filter((team) => !team.userId);
  const missingRows = Math.max(0, season.teamCount - existingTeams.length);
  const slotsToFill = openTeams.length + missingRows;
  if (slotsToFill <= 0) {
    return { success: false, error: "League is already full." };
  }

  const seasonDivisions = await db
    .select({ id: divisions.id })
    .from(divisions)
    .where(eq(divisions.leagueSeasonId, season.id))
    .orderBy(asc(divisions.sortOrder));

  const maxDraftSlot = existingTeams.reduce(
    (max, team) => Math.max(max, team.draftSlot ?? 0),
    0,
  );
  const maxWaiverPriority = existingTeams.reduce(
    (max, team) => Math.max(max, team.waiverPriority ?? 0),
    0,
  );

  const faabRemaining =
    season.waiversEnabled &&
    season.waiverType === "faab" &&
    season.faabBudget != null
      ? season.faabBudget
      : null;

  const takenNames = new Set(
    existingTeams.map((team) => team.name.toLowerCase()),
  );
  const takenSlugs = new Set(
    existingTeams
      .map((team) => team.slug)
      .filter((slug): slug is string => Boolean(slug)),
  );

  function allocateBotTeamName(slotNumber: number) {
    const name = nextBotTeamName(takenNames, slotNumber - 1);
    takenNames.add(name.toLowerCase());
    return name;
  }

  await db.transaction(async (tx) => {
    const insertedTeamIds: string[] = [];
    let botIndex = 0;

    for (const openTeam of openTeams) {
      botIndex += 1;
      const userId = crypto.randomUUID();
      const teamName = allocateBotTeamName(botIndex);
      const teamSlug = allocateUniqueTeamSlug(teamName, takenSlugs, userId);
      takenSlugs.add(teamSlug);

      await tx.insert(profiles).values({
        id: userId,
        displayName: `Bot Manager ${botIndex}`,
      });

      await tx.insert(leagueMembers).values({
        leagueId: league.id,
        userId,
        role: "member",
      });

      await tx
        .update(teams)
        .set({
          userId,
          name: teamName,
          slug: teamSlug,
          autoPickEnabled: true,
        })
        .where(eq(teams.id, openTeam.id));
    }

    for (let i = 0; i < missingRows; i++) {
      botIndex += 1;
      const userId = crypto.randomUUID();
      const teamName = allocateBotTeamName(botIndex);
      const teamSlug = allocateUniqueTeamSlug(teamName, takenSlugs, userId);
      takenSlugs.add(teamSlug);

      await tx.insert(profiles).values({
        id: userId,
        displayName: `Bot Manager ${botIndex}`,
      });

      await tx.insert(leagueMembers).values({
        leagueId: league.id,
        userId,
        role: "member",
      });

      const [inserted] = await tx
        .insert(teams)
        .values({
          leagueSeasonId: season.id,
          userId,
          name: teamName,
          publicId: generatePublicId(),
          slug: teamSlug,
          divisionId:
            seasonDivisions.length > 0
              ? seasonDivisions[
                  (existingTeams.length + i) % seasonDivisions.length
                ]!.id
              : null,
          draftSlot: maxDraftSlot + i + 1,
          autoPickEnabled: true,
          waiverPriority: maxWaiverPriority + i + 1,
          faabRemaining,
        })
        .returning({ id: teams.id });

      if (inserted) {
        insertedTeamIds.push(inserted.id);
      }
    }

    const allTeamIds = [
      ...existingTeams.map((team) => team.id),
      ...insertedTeamIds,
    ];

    if (allTeamIds.length === season.teamCount && season.teamCount >= 2) {
      const schedule = resolveScheduleSettings(season.settings.schedule);
      await replaceSeasonMatchups(tx, {
        leagueSeasonId: season.id,
        teamIds: allTeamIds,
        weekCount: season.regularSeasonEndWeek,
        playEachOtherTimes: clampPlayEachOtherTimes(
          schedule.playEachOtherTimes,
          season.divisionCount,
        ),
      });
    }
  });

  revalidateSettingsPaths(slug);
  revalidatePath(`/league/${slug}/players`);
  revalidatePath(`/league/${slug}/team`);

  return { success: true, filledCount: slotsToFill };
}

export async function openFreeAgency(
  slug: string,
  mode: OpenFreeAgencyMode,
): Promise<ActionResult> {
  if (mode !== "draft_later" && mode !== "no_draft") {
    return { success: false, error: "Invalid free agency option." };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;

  if (mode === "no_draft") {
    await db
      .update(leagueSeasons)
      .set({
        freeAgencyOpen: true,
        status: "active",
      })
      .where(eq(leagueSeasons.id, season.id));
  } else if (!season.freeAgencyOpen) {
    await db
      .update(leagueSeasons)
      .set({ freeAgencyOpen: true })
      .where(eq(leagueSeasons.id, season.id));
  }

  revalidateSettingsPaths(slug);
  revalidatePath(`/league/${slug}/players`);
  revalidatePath(`/league/${slug}/team`);

  return { success: true };
}

export async function updateLeagueSize(
  slug: string,
  input: {
    teamCount: number;
    divisionCount: number;
    divisionNames?: string[];
  },
): Promise<ActionResult> {
  const teamCount = input.teamCount;
  const divisionCount = input.divisionCount;

  if (
    !Number.isInteger(teamCount) ||
    teamCount < TEAM_COUNT_MIN ||
    teamCount > TEAM_COUNT_MAX
  ) {
    return {
      success: false,
      error: `League size must be between ${TEAM_COUNT_MIN} and ${TEAM_COUNT_MAX}.`,
    };
  }

  if (
    !Number.isInteger(divisionCount) ||
    divisionCount < 1 ||
    divisionCount > 4
  ) {
    return {
      success: false,
      error: "Division count must be between 1 and 4.",
    };
  }

  if (teamCount % divisionCount !== 0) {
    return {
      success: false,
      error: "League size must divide evenly by the number of divisions.",
    };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season, league } = result;

  const [memberCountRow] = await db
    .select({ value: count() })
    .from(leagueMembers)
    .where(eq(leagueMembers.leagueId, league.id));
  const memberCount = Number(memberCountRow?.value ?? 0);

  if (teamCount < memberCount) {
    return {
      success: false,
      error: `Remove ${memberCount - teamCount} owner${
        memberCount - teamCount === 1 ? "" : "s"
      } before shrinking the league.`,
    };
  }

  const requestedNames =
    divisionCount > 1
      ? (input.divisionNames ?? []).map((name) => name.trim())
      : [];

  if (divisionCount > 1) {
    if (requestedNames.length !== divisionCount) {
      return {
        success: false,
        error: "Provide a name for each division.",
      };
    }
    if (requestedNames.some((name) => name.length < 1 || name.length > 40)) {
      return {
        success: false,
        error: "Division names must be 1–40 characters.",
      };
    }
  }

  const existingDivisions = await db
    .select({
      id: divisions.id,
      name: divisions.name,
      sortOrder: divisions.sortOrder,
    })
    .from(divisions)
    .where(eq(divisions.leagueSeasonId, season.id))
    .orderBy(asc(divisions.sortOrder));

  if (teamCount < season.teamCount) {
    const vacantTeams = await db
      .select({ id: teams.id, userId: teams.userId })
      .from(teams)
      .where(
        and(eq(teams.leagueSeasonId, season.id), isNull(teams.userId)),
      );

    const teamRows = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.leagueSeasonId, season.id));

    const excess = Math.max(0, teamRows.length - teamCount);
    if (excess > vacantTeams.length) {
      return {
        success: false,
        error: "Remove owners before shrinking the league further.",
      };
    }

    const toDelete = vacantTeams.slice(0, excess);
    if (toDelete.length > 0) {
      const deleteIds = toDelete.map((row) => row.id);
      await db.transaction(async (tx) => {
        for (const id of deleteIds) {
          await tx.delete(teams).where(eq(teams.id, id));
        }
      });
    }
  }

  const playoffs = resolvePlayoffSettings(season.settings.playoffs);
  const nextPlayoffTeamCount = clampPlayoffTeamCount(
    season.playoffTeamCount,
    teamCount,
  );

  await db.transaction(async (tx) => {
    await tx
      .update(leagueSeasons)
      .set({
        teamCount,
        divisionCount,
        playoffTeamCount: nextPlayoffTeamCount,
        settings: {
          ...season.settings,
          playoffs: {
            ...playoffs,
          },
        },
      })
      .where(eq(leagueSeasons.id, season.id));

    if (divisionCount === 1) {
      if (existingDivisions.length > 0) {
        await tx
          .update(teams)
          .set({ divisionId: null })
          .where(eq(teams.leagueSeasonId, season.id));
        await tx
          .delete(divisions)
          .where(eq(divisions.leagueSeasonId, season.id));
      }
      return;
    }

    const keep = existingDivisions.slice(0, divisionCount);
    const remove = existingDivisions.slice(divisionCount);

    for (let i = 0; i < keep.length; i++) {
      const division = keep[i]!;
      const nextName =
        requestedNames[i] ??
        division.name ??
        `Division ${String.fromCharCode(65 + i)}`;
      await tx
        .update(divisions)
        .set({ name: nextName, sortOrder: i })
        .where(eq(divisions.id, division.id));
    }

    if (remove.length > 0) {
      const removeIds = remove.map((row) => row.id);
      await tx
        .update(teams)
        .set({ divisionId: null })
        .where(
          and(
            eq(teams.leagueSeasonId, season.id),
            inArray(teams.divisionId, removeIds),
          ),
        );
      for (const division of remove) {
        await tx.delete(divisions).where(eq(divisions.id, division.id));
      }
    }

    for (let i = keep.length; i < divisionCount; i++) {
      await tx.insert(divisions).values({
        leagueSeasonId: season.id,
        name:
          requestedNames[i] ?? `Division ${String.fromCharCode(65 + i)}`,
        sortOrder: i,
      });
    }
  });

  revalidateSettingsPaths(slug);
  return { success: true };
}

export async function realignDivisions(
  slug: string,
  assignments: Record<string, string>,
): Promise<ActionResult> {
  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;

  if (season.divisionCount < 2) {
    return {
      success: false,
      error: "Realign is only available when the league has 2+ divisions.",
    };
  }

  const seasonDivisions = await db
    .select({ id: divisions.id })
    .from(divisions)
    .where(eq(divisions.leagueSeasonId, season.id))
    .orderBy(asc(divisions.sortOrder));

  if (seasonDivisions.length < 2) {
    return { success: false, error: "This league has no divisions to realign." };
  }

  const divisionIds = seasonDivisions.map((row) => row.id);
  const seasonTeams = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.leagueSeasonId, season.id));

  if (Object.keys(assignments).length !== seasonTeams.length) {
    return { success: false, error: "Assign every team to a division." };
  }

  const teamIdSet = new Set(seasonTeams.map((row) => row.id));
  for (const [teamId, divisionId] of Object.entries(assignments)) {
    if (!teamIdSet.has(teamId)) {
      return { success: false, error: "Assignments include an unknown team." };
    }
    if (!divisionIds.includes(divisionId)) {
      return {
        success: false,
        error: "Assignments include an unknown division.",
      };
    }
  }

  if (!areDivisionsBalanced(divisionIds, assignments)) {
    return {
      success: false,
      error: "Divisions must stay balanced before you can save.",
    };
  }

  await db.transaction(async (tx) => {
    for (const [teamId, divisionId] of Object.entries(assignments)) {
      await tx
        .update(teams)
        .set({ divisionId })
        .where(eq(teams.id, teamId));
    }
  });

  revalidateSettingsPaths(slug);
  return { success: true };
}
