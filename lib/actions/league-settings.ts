"use server";

import { and, asc, count, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  divisions,
  leagueActivity,
  leagueMembers,
  leagues,
  leagueSeasons,
  profiles,
  teams,
} from "@/db/schema";
import { requireSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  draftConfigFormSchema,
  draftConfigPickTimeSeconds,
  resolveDraftSettings,
  toPersistedDraftSettings,
  type DraftConfigFormValues,
} from "@/lib/leagues/draft-settings";
import {
  buildPersistedRosterSlots,
  rosterRequirementsSchema,
  type RosterRequirementsValues,
} from "@/lib/leagues/roster";
import { lineupLockModeSchema } from "@/lib/leagues/lineup-lock";
import type { LineupLockMode } from "@/db/schema/league-seasons";
import {
  leagueIdentityFormSchema,
  type LeagueIdentityFormValues,
} from "@/lib/leagues/league-identity";
import {
  areDivisionsBalanced,
  isOwnerRemovalReason,
  ownerRemovalReasonLabel,
  type OwnerRemovalReason,
} from "@/lib/leagues/membership";
import {
  toPersistedWaiverWire,
  waiverWireFormSchema,
  type WaiverWireFormValues,
} from "@/lib/leagues/waiver-wire";
import {
  tiebreakerSettingsSchema,
  type TiebreakerSettings,
} from "@/lib/leagues/tiebreakers";
import {
  toPersistedTransactionRules,
  transactionRulesFormSchema,
  type TransactionRulesFormValues,
} from "@/lib/leagues/transaction-rules";
import {
  getDefaultScoringRuleDefinitions,
  type ScoringPreset,
  type ScoringRuleDefinition,
} from "@/lib/leagues/scoring";
import { slugifyLeagueName } from "@/lib/leagues/utils";
import { allocateUniqueTeamSlug } from "@/lib/leagues/utils";
import { generatePublicId } from "@/lib/leagues/public-id";
import {
  getLeagueBySlug,
  isLeagueCommissioner,
  isPrimaryCommissioner,
} from "@/lib/queries/leagues";
import { replaceSeasonMatchups } from "@/lib/leagues/schedule/persist";
import {
  clampPlayEachOtherTimes,
  resolveScheduleSettings,
} from "@/lib/leagues/schedule/settings";
import {
  clampPlayoffTeamCount,
  parsePlayoffSettingsForm,
  resolvePlayoffSettings,
} from "@/lib/leagues/playoff-settings";
import {
  isScheduleEditable,
  TEAM_COUNT_MAX,
  TEAM_COUNT_MIN,
} from "@/lib/leagues/season-calendar";
import { getNflState } from "@/lib/sleeper/api";

type ActionResult = {
  success: boolean;
  error?: string;
  fieldError?: string;
  fieldErrors?: Partial<Record<"name" | "logoUrl" | "divisions", string>>;
  redirectSlug?: string;
  teamIds?: string[];
  filledCount?: number;
};

const BOT_TEAM_NAMES = [
  "Gridiron Gang",
  "Red Zone Renegades",
  "Blitz Brigade",
  "Pocket Passers",
  "End Zone Express",
  "Fourth Down Faithful",
  "Hashmark Heroes",
  "Sunday Scramblers",
  "Goal Line Guardians",
  "Trophy Hunters",
  "Pigskin Prophets",
  "Audible Outlaws",
  "Two Minute Drill",
  "Nose Tackle Nasties",
  "Fantasy Phenoms",
] as const;

const SCORING_PRESETS: ScoringPreset[] = [
  "standard",
  "half_ppr",
  "full_ppr",
];

async function getCommissionerSeason(slug: string) {
  const user = await requireSessionUser();
  const league = await getLeagueBySlug(slug);

  if (!league) {
    return { error: "League not found." as const };
  }

  const isCommissioner = await isLeagueCommissioner(league.id, user.id);
  if (!isCommissioner) {
    return {
      error: "Only the commissioner can edit league settings." as const,
    };
  }

  const [season] = await db
    .select()
    .from(leagueSeasons)
    .where(eq(leagueSeasons.leagueId, league.id))
    .limit(1);

  if (!season) {
    return { error: "League season not found." as const };
  }

  return { season, league };
}

async function assertScheduleStillEditable(seasonYear: number) {
  const nfl = await getNflState();
  if (!isScheduleEditable(seasonYear, nfl)) {
    return {
      success: false as const,
      error:
        "Schedule and playoff settings lock once NFL Week 1 of the season begins.",
    };
  }
  return { success: true as const, nfl };
}

function revalidateSettingsPaths(slug: string) {
  revalidatePath(`/league/${slug}/settings`);
  revalidatePath(`/league/${slug}/settings/scoring`);
  revalidatePath(`/league/${slug}/settings/roster`);
  revalidatePath(`/league/${slug}/settings/lineup-locking`);
  revalidatePath(`/league/${slug}/settings/waivers`);
  revalidatePath(`/league/${slug}/settings/tiebreakers`);
  revalidatePath(`/league/${slug}/settings/transactions`);
  revalidatePath(`/league/${slug}/settings/league`);
  revalidatePath(`/league/${slug}/settings/draft`);
  revalidatePath(`/league/${slug}/settings/draft-order`);
  revalidatePath(`/league/${slug}/settings/waiver-order`);
  revalidatePath(`/league/${slug}/settings/lineups`);
  revalidatePath(`/league/${slug}/settings/league-size`);
  revalidatePath(`/league/${slug}/settings/realign-divisions`);
  revalidatePath(`/league/${slug}/settings/co-commissioners`);
  revalidatePath(`/league/${slug}/settings/schedule`);
  revalidatePath(`/league/${slug}/settings/playoffs`);
  revalidatePath(`/league/${slug}/draft`);
  revalidatePath(`/league/${slug}`);
  revalidatePath("/leagues");
}

async function generateUniqueSlug(baseSlug: string, excludeLeagueId: string) {
  let slug = baseSlug || "league";
  let suffix = 0;

  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const existing = await getLeagueBySlug(candidate);
    if (!existing || existing.id === excludeLeagueId) {
      return candidate;
    }
    suffix += 1;
  }
}

function fieldErrorsFromZod(
  issues: { path: PropertyKey[]; message: string }[],
): Partial<Record<"name" | "logoUrl" | "divisions", string>> {
  const fieldErrors: Partial<
    Record<"name" | "logoUrl" | "divisions", string>
  > = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key === "name" || key === "logoUrl" || key === "divisions") {
      fieldErrors[key] ??= issue.message;
    }
  }
  return fieldErrors;
}

export async function updateRegularSeasonSchedule(
  slug: string,
  playEachOtherTimes: number,
): Promise<ActionResult> {
  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;
  const editable = await assertScheduleStillEditable(season.seasonYear);
  if (!editable.success) {
    return editable;
  }

  const times = clampPlayEachOtherTimes(
    playEachOtherTimes,
    season.divisionCount,
  );

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

  revalidateSettingsPaths(slug);

  return { success: true };
}

export async function regenerateRegularSeasonSchedule(
  slug: string,
): Promise<ActionResult> {
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
  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;
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

  revalidateSettingsPaths(slug);
  revalidatePath(`/league/${slug}/settings/transactions`);

  return { success: true };
}

export async function updateScoringPreset(
  slug: string,
  scoringPreset: ScoringPreset,
): Promise<ActionResult> {
  if (!SCORING_PRESETS.includes(scoringPreset)) {
    return { success: false, error: "Invalid scoring preset." };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;

  await db
    .update(leagueSeasons)
    .set({
      scoringPreset,
      settings: {
        ...season.settings,
        scoringRules: getDefaultScoringRuleDefinitions(scoringPreset),
      },
    })
    .where(eq(leagueSeasons.id, season.id));

  revalidateSettingsPaths(slug);

  return { success: true };
}

export async function updateScoringRules(
  slug: string,
  scoringRules: ScoringRuleDefinition[],
): Promise<ActionResult> {
  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;

  await db
    .update(leagueSeasons)
    .set({
      settings: {
        ...season.settings,
        scoringRules,
      },
    })
    .where(eq(leagueSeasons.id, season.id));

  revalidateSettingsPaths(slug);

  return { success: true };
}

export async function updateRosterRequirements(
  slug: string,
  values: RosterRequirementsValues,
): Promise<ActionResult> {
  const parsed = rosterRequirementsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid roster settings.",
    };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;
  const next = parsed.data;
  const rosterSlots = buildPersistedRosterSlots(next);

  await db
    .update(leagueSeasons)
    .set({
      rosterMode: next.rosterMode,
      benchSlots: next.benchSlots,
      irEnabled: next.irEnabled,
      irSlots: next.irEnabled ? next.irSlots : 0,
      taxiEnabled: next.taxiEnabled,
      taxiSlots: next.taxiEnabled ? next.taxiSlots : 0,
      settings: {
        ...season.settings,
        rosterSlots,
        irEligibleStatuses: next.irEnabled
          ? next.irEligibleStatuses
          : season.settings.irEligibleStatuses,
      },
    })
    .where(eq(leagueSeasons.id, season.id));

  revalidateSettingsPaths(slug);

  return { success: true };
}

export async function updateLineupLockMode(
  slug: string,
  lineupLockMode: LineupLockMode,
): Promise<ActionResult> {
  const parsed = lineupLockModeSchema.safeParse(lineupLockMode);
  if (!parsed.success) {
    return { success: false, error: "Invalid lineup lock mode." };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;

  await db
    .update(leagueSeasons)
    .set({
      settings: {
        ...season.settings,
        lineupLockMode: parsed.data,
      },
    })
    .where(eq(leagueSeasons.id, season.id));

  revalidateSettingsPaths(slug);

  return { success: true };
}

export async function updateWaiverWireRules(
  slug: string,
  values: WaiverWireFormValues,
): Promise<ActionResult> {
  const parsed = waiverWireFormSchema.safeParse(values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false,
      error: issue?.message ?? "Invalid waiver settings.",
      fieldError:
        issue?.path[0] === "processDays" || issue?.path[0] === "faabBudget"
          ? issue.message
          : undefined,
    };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;
  const next = parsed.data;

  await db
    .update(leagueSeasons)
    .set({
      waiversEnabled: next.waiversEnabled,
      waiverType: next.waiverType,
      faabBudget:
        next.waiversEnabled && next.waiverType === "faab"
          ? next.faabBudget
          : null,
      settings: {
        ...season.settings,
        waiverWire: toPersistedWaiverWire(next),
      },
    })
    .where(eq(leagueSeasons.id, season.id));

  // Seed FAAB only for teams that don't have a budget yet (don't reset spends).
  if (next.waiversEnabled && next.waiverType === "faab") {
    await db
      .update(teams)
      .set({ faabRemaining: next.faabBudget })
      .where(
        and(eq(teams.leagueSeasonId, season.id), isNull(teams.faabRemaining)),
      );
  } else {
    await db
      .update(teams)
      .set({ faabRemaining: null })
      .where(eq(teams.leagueSeasonId, season.id));
  }

  revalidateSettingsPaths(slug);

  return { success: true };
}

export async function updateTiebreakerSettings(
  slug: string,
  values: TiebreakerSettings,
): Promise<ActionResult> {
  const parsed = tiebreakerSettingsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid tiebreak settings.",
    };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;

  await db
    .update(leagueSeasons)
    .set({
      settings: {
        ...season.settings,
        tiebreakers: parsed.data,
      },
    })
    .where(eq(leagueSeasons.id, season.id));

  revalidateSettingsPaths(slug);

  return { success: true };
}

export async function updateTransactionRules(
  slug: string,
  values: TransactionRulesFormValues,
): Promise<ActionResult> {
  const parsed = transactionRulesFormSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid transaction settings.",
    };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;
  const next = parsed.data;

  await db
    .update(leagueSeasons)
    .set({
      tradesEnabled: next.tradesEnabled,
      tradeProcessing: next.tradeProcessing,
      tradeDeadlineWeek: next.tradesEnabled ? next.tradeDeadlineWeek : null,
      settings: {
        ...season.settings,
        transactionRules: toPersistedTransactionRules(next),
      },
    })
    .where(eq(leagueSeasons.id, season.id));

  revalidateSettingsPaths(slug);

  return { success: true };
}

export async function updateLeagueIdentity(
  slug: string,
  values: LeagueIdentityFormValues,
): Promise<ActionResult> {
  const parsed = leagueIdentityFormSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid league settings.",
      fieldErrors: fieldErrorsFromZod(parsed.error.issues),
    };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season, league } = result;
  const next = parsed.data;

  const seasonDivisions = await db
    .select({ id: divisions.id })
    .from(divisions)
    .where(eq(divisions.leagueSeasonId, season.id))
    .orderBy(asc(divisions.sortOrder));

  const seasonDivisionIds = new Set(seasonDivisions.map((row) => row.id));
  if (
    next.divisions.length !== seasonDivisions.length ||
    next.divisions.some((division) => !seasonDivisionIds.has(division.id))
  ) {
    return {
      success: false,
      error: "Division list is out of date. Refresh and try again.",
      fieldErrors: { divisions: "Division list is out of date." },
    };
  }

  const nextSlug = await generateUniqueSlug(
    slugifyLeagueName(next.name),
    league.id,
  );

  const nextLogoUrl =
    next.logoMode === "remove"
      ? null
      : next.logoMode === "url" || next.logoMode === "upload"
        ? next.logoUrl.trim()
        : (season.settings.logoUrl ?? null);

  await db.transaction(async (tx) => {
    await tx
      .update(leagues)
      .set({
        name: next.name.trim(),
        slug: nextSlug,
      })
      .where(eq(leagues.id, league.id));

    await tx
      .update(leagueSeasons)
      .set({
        settings: {
          ...season.settings,
          logoUrl: nextLogoUrl,
        },
      })
      .where(eq(leagueSeasons.id, season.id));

    for (const division of next.divisions) {
      await tx
        .update(divisions)
        .set({ name: division.name.trim() })
        .where(
          and(
            eq(divisions.id, division.id),
            eq(divisions.leagueSeasonId, season.id),
          ),
        );
    }
  });

  revalidateSettingsPaths(slug);

  return { success: true, redirectSlug: league.publicId };
}

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

  const draftDefaults = resolveDraftSettings(season.settings.draft);
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

  function nextBotTeamName(slotNumber: number) {
    for (const name of BOT_TEAM_NAMES) {
      if (!takenNames.has(name.toLowerCase())) {
        takenNames.add(name.toLowerCase());
        return name;
      }
    }
    const fallback = `Bot Team ${slotNumber}`;
    takenNames.add(fallback.toLowerCase());
    return fallback;
  }

  await db.transaction(async (tx) => {
    const insertedTeamIds: string[] = [];
    let botIndex = 0;

    for (const openTeam of openTeams) {
      botIndex += 1;
      const userId = crypto.randomUUID();
      const teamName = nextBotTeamName(botIndex);
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
          autoPickEnabled: draftDefaults.autoPickEnabled,
        })
        .where(eq(teams.id, openTeam.id));
    }

    for (let i = 0; i < missingRows; i++) {
      botIndex += 1;
      const userId = crypto.randomUUID();
      const teamName = nextBotTeamName(botIndex);
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
          autoPickEnabled: draftDefaults.autoPickEnabled,
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

export async function updateDraftConfig(
  slug: string,
  values: DraftConfigFormValues,
): Promise<ActionResult> {
  const parsed = draftConfigFormSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid draft settings.",
    };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;
  const next = parsed.data;
  const draftStartAt = new Date(next.draftStartAt);

  await db
    .update(leagueSeasons)
    .set({
      draftType: next.draftType,
      draftStartAt,
      pickTimeLimitSeconds: draftConfigPickTimeSeconds(next),
      emailNotificationsEnabled: next.draftType === "email",
      settings: {
        ...season.settings,
        draft: toPersistedDraftSettings(next),
      },
    })
    .where(eq(leagueSeasons.id, season.id));

  // Apply league autopick default to all teams.
  await db
    .update(teams)
    .set({ autoPickEnabled: next.autoPickEnabled })
    .where(eq(teams.leagueSeasonId, season.id));

  revalidateSettingsPaths(slug);
  return { success: true };
}

export async function updateDraftOrder(
  slug: string,
  teamIdsInOrder: string[],
): Promise<ActionResult> {
  if (!Array.isArray(teamIdsInOrder) || teamIdsInOrder.length === 0) {
    return { success: false, error: "Draft order is empty." };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;

  if (season.status === "active") {
    return {
      success: false,
      error: "Draft order can’t be changed after the season is active.",
    };
  }

  const existing = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.leagueSeasonId, season.id));

  const existingIds = new Set(existing.map((row) => row.id));
  if (teamIdsInOrder.length !== existingIds.size) {
    return { success: false, error: "Draft order must include every team." };
  }
  for (const id of teamIdsInOrder) {
    if (!existingIds.has(id)) {
      return { success: false, error: "Draft order includes an unknown team." };
    }
  }

  for (let index = 0; index < teamIdsInOrder.length; index++) {
    await db
      .update(teams)
      .set({ draftSlot: index + 1 })
      .where(eq(teams.id, teamIdsInOrder[index]!));
  }

  revalidateSettingsPaths(slug);
  return { success: true };
}

export async function randomizeDraftOrder(
  slug: string,
): Promise<ActionResult> {
  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;

  if (season.status === "active") {
    return {
      success: false,
      error: "Draft order can’t be changed after the season is active.",
    };
  }

  const existing = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.leagueSeasonId, season.id))
    .orderBy(asc(teams.createdAt));

  const shuffled = [...existing.map((row) => row.id)];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }

  for (let index = 0; index < shuffled.length; index++) {
    await db
      .update(teams)
      .set({ draftSlot: index + 1 })
      .where(eq(teams.id, shuffled[index]!));
  }

  revalidateSettingsPaths(slug);
  return { success: true, teamIds: shuffled };
}

export async function updateWaiverOrder(
  slug: string,
  teamIdsInOrder: string[],
): Promise<ActionResult> {
  if (!Array.isArray(teamIdsInOrder) || teamIdsInOrder.length === 0) {
    return { success: false, error: "Waiver order is empty." };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;

  const existing = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.leagueSeasonId, season.id));

  const existingIds = new Set(existing.map((row) => row.id));
  if (teamIdsInOrder.length !== existingIds.size) {
    return { success: false, error: "Waiver order must include every team." };
  }
  for (const id of teamIdsInOrder) {
    if (!existingIds.has(id)) {
      return { success: false, error: "Waiver order includes an unknown team." };
    }
  }

  for (let index = 0; index < teamIdsInOrder.length; index++) {
    await db
      .update(teams)
      .set({ waiverPriority: index + 1 })
      .where(eq(teams.id, teamIdsInOrder[index]!));
  }

  revalidateSettingsPaths(slug);
  return { success: true };
}

export async function removeLeagueOwner(
  slug: string,
  userId: string,
  reason?: OwnerRemovalReason | null,
): Promise<ActionResult> {
  if (!userId) {
    return { success: false, error: "Select an owner to remove." };
  }
  if (reason != null && !isOwnerRemovalReason(reason)) {
    return { success: false, error: "Invalid removal reason." };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season, league } = result;
  const actor = await requireSessionUser();

  if (userId === actor.id) {
    return { success: false, error: "You can’t remove yourself." };
  }

  const [targetMember] = await db
    .select({
      userId: leagueMembers.userId,
      role: leagueMembers.role,
      displayName: profiles.displayName,
    })
    .from(leagueMembers)
    .innerJoin(profiles, eq(leagueMembers.userId, profiles.id))
    .where(
      and(
        eq(leagueMembers.leagueId, league.id),
        eq(leagueMembers.userId, userId),
      ),
    )
    .limit(1);

  if (!targetMember) {
    return { success: false, error: "That owner is not in this league." };
  }

  if (targetMember.role === "commissioner") {
    return {
      success: false,
      error: "The commissioner can’t be removed. Step down first.",
    };
  }

  const [targetTeam] = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(
      and(eq(teams.leagueSeasonId, season.id), eq(teams.userId, userId)),
    )
    .limit(1);

  const reasonLabel = ownerRemovalReasonLabel(reason ?? null);
  const displayName = targetMember.displayName?.trim() || "Owner";

  await db.transaction(async (tx) => {
    if (targetTeam) {
      await tx
        .update(teams)
        .set({ userId: null })
        .where(eq(teams.id, targetTeam.id));
    }

    await tx
      .delete(leagueMembers)
      .where(
        and(
          eq(leagueMembers.leagueId, league.id),
          eq(leagueMembers.userId, userId),
        ),
      );

    await tx.insert(leagueActivity).values({
      leagueSeasonId: season.id,
      type: "member_removed",
      teamId: targetTeam?.id ?? null,
      actorUserId: actor.id,
      summary: reasonLabel
        ? `${displayName} was removed from the league (${reasonLabel}).`
        : `${displayName} was removed from the league.`,
      metadata: {
        removalReason: reason ?? null,
        removedUserId: userId,
        removedDisplayName: displayName,
        teamName: targetTeam?.name ?? null,
      },
    });
  });

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

export async function updateCoCommissioners(
  slug: string,
  coCommissionerUserIds: string[],
): Promise<ActionResult> {
  if (!Array.isArray(coCommissionerUserIds)) {
    return { success: false, error: "Invalid co-commissioner list." };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { league } = result;
  const actor = await requireSessionUser();
  const isPrimary = await isPrimaryCommissioner(league.id, actor.id);
  if (!isPrimary) {
    return {
      success: false,
      error: "Only the commissioner can appoint co-commissioners.",
    };
  }

  const uniqueIds = [...new Set(coCommissionerUserIds)];

  const members = await db
    .select({
      userId: leagueMembers.userId,
      role: leagueMembers.role,
    })
    .from(leagueMembers)
    .where(eq(leagueMembers.leagueId, league.id));

  const memberById = new Map(members.map((row) => [row.userId, row]));

  for (const userId of uniqueIds) {
    const member = memberById.get(userId);
    if (!member) {
      return {
        success: false,
        error: "Co-commissioners must already be league members.",
      };
    }
    if (member.role === "commissioner") {
      return {
        success: false,
        error: "The commissioner is already in charge.",
      };
    }
  }

  await db.transaction(async (tx) => {
    for (const member of members) {
      if (member.role === "commissioner") {
        continue;
      }
      const shouldBeCo = uniqueIds.includes(member.userId);
      const nextRole = shouldBeCo ? "co_commissioner" : "member";
      if (member.role !== nextRole) {
        await tx
          .update(leagueMembers)
          .set({ role: nextRole })
          .where(
            and(
              eq(leagueMembers.leagueId, league.id),
              eq(leagueMembers.userId, member.userId),
            ),
          );
      }
    }
  });

  revalidateSettingsPaths(slug);
  return { success: true };
}
