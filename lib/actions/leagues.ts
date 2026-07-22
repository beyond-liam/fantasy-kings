"use server";

import { and, asc, count, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";

import {
  divisions,
  leagueMembers,
  leagues,
  leagueSeasons,
  teams,
} from "@/db/schema";
import { ensureProfile, requireSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { pickTimeToSeconds } from "@/lib/leagues/defaults";
import { DEFAULT_DRAFT_SETTINGS } from "@/lib/leagues/draft-settings";
import { DEFAULT_PLAYOFF_SETTINGS } from "@/lib/leagues/playoff-settings";
import { buildPersistedRosterSlots } from "@/lib/leagues/roster";
import { generateScheduleIfLeagueFull } from "@/lib/leagues/schedule/persist";
import { DEFAULT_SCHEDULE_SETTINGS } from "@/lib/leagues/schedule/settings";
import { getRegularSeasonEndWeek } from "@/lib/leagues/season-calendar";
import {
  createLeagueWizardSchema,
  type CreateLeagueWizardValues,
} from "@/lib/leagues/wizard-schema";
import {
  allocateUniqueTeamSlug,
  generateInviteCode,
  getDefaultTeamName,
  slugifyLeagueName,
} from "@/lib/leagues/utils";
import { nextLeaguePublicId } from "@/lib/leagues/ensure-public-ids";
import { generatePublicId } from "@/lib/leagues/public-id";
import { getNflState } from "@/lib/sleeper/api";
import {
  getLeagueByInviteCode,
  getLeagueBySlug,
  isLeagueMember,
} from "@/lib/queries/leagues";
import { ensureSeasonTeamSlots } from "@/lib/leagues/ensure-team-slots";

function isUniqueViolation(error: unknown): boolean {
  const codes = new Set<string>();
  let current: unknown = error;
  for (let i = 0; i < 4 && current; i++) {
    if (typeof current === "object" && current !== null && "code" in current) {
      codes.add(String((current as { code: unknown }).code));
    }
    current =
      typeof current === "object" && current !== null && "cause" in current
        ? (current as { cause: unknown }).cause
        : null;
  }
  return codes.has("23505");
}

async function generateUniqueInviteCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const inviteCode = generateInviteCode();
    const existing = await getLeagueByInviteCode(inviteCode);
    if (!existing) {
      return inviteCode;
    }
  }
  throw new Error("Could not generate invite code");
}

async function generateUniqueSlug(baseSlug: string) {
  let slug = baseSlug || "league";
  let suffix = 0;

  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const existing = await getLeagueBySlug(candidate);
    if (!existing) {
      return candidate;
    }
    suffix += 1;
  }
}

export async function createLeague(input: CreateLeagueWizardValues) {
  const parsed = createLeagueWizardSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid league settings.",
    };
  }
  const values = parsed.data;

  const user = await requireSessionUser();
  const profile = await ensureProfile(user);
  if (!profile.onboardedAt) {
    return { error: "Finish setting up your account first." };
  }

  const nflState = await getNflState();
  const seasonYear = Number(nflState.season);
  const slug = await generateUniqueSlug(slugifyLeagueName(values.leagueName));
  const publicId = await nextLeaguePublicId();
  const inviteCode = await generateUniqueInviteCode();
  const regularSeasonEndWeek = getRegularSeasonEndWeek(
    values.championshipWeek,
    values.playoffTeamCount,
  );

  const rosterSlots = buildPersistedRosterSlots({
    rosterMode: values.rosterMode,
    benchSlots: values.benchSlots,
    irEnabled: values.irEnabled,
    irSlots: values.irSlots,
    irEligibleStatuses: values.irEligibleStatuses,
    taxiEnabled: values.taxiEnabled,
    taxiSlots: values.taxiSlots,
    customRosterSlots: values.customRosterSlots,
  });

  const tradeDeadlineWeek =
    values.tradesEnabled && values.tradeDeadlineWeek
      ? values.tradeDeadlineWeek
      : regularSeasonEndWeek;

  const result = await db.transaction(async (tx) => {
    const [league] = await tx
      .insert(leagues)
      .values({
        name: values.leagueName,
        publicId,
        slug,
        inviteCode,
        commissionerId: user.id,
      })
      .returning();

    const [season] = await tx
      .insert(leagueSeasons)
      .values({
        leagueId: league.id,
        seasonYear,
        status: "recruiting",
        leagueType: values.leagueType,
        teamCount: values.teamCount,
        divisionCount: values.divisionCount,
        playoffTeamCount: values.playoffTeamCount,
        championshipWeek: values.championshipWeek,
        regularSeasonEndWeek,
        rosterMode: values.rosterMode,
        benchSlots: values.benchSlots,
        irEnabled: values.irEnabled,
        irSlots: values.irEnabled ? values.irSlots : 0,
        taxiEnabled: values.taxiEnabled,
        taxiSlots: values.taxiEnabled ? values.taxiSlots : 0,
        scoringPreset: values.scoringPreset,
        waiversEnabled: values.waiversEnabled,
        waiverType: values.waiverType,
        faabBudget:
          values.waiversEnabled && values.waiverType === "faab"
            ? values.faabBudget
            : null,
        tradesEnabled: values.tradesEnabled,
        tradeProcessing: values.tradeProcessing,
        tradeDeadlineWeek: values.tradesEnabled ? tradeDeadlineWeek : null,
        draftType: values.draftType,
        draftStartAt: new Date(values.draftStartAt),
        pickTimeLimitSeconds: pickTimeToSeconds(
          values.pickTimeLimit,
          values.pickTimeUnit,
        ),
        emailNotificationsEnabled: values.draftType === "email",
        settings: {
          rosterSlots,
          draft: DEFAULT_DRAFT_SETTINGS,
          schedule: DEFAULT_SCHEDULE_SETTINGS,
          playoffs: DEFAULT_PLAYOFF_SETTINGS,
          irEligibleStatuses: values.irEnabled
            ? values.irEligibleStatuses
            : undefined,
        },
      })
      .returning();

    if (values.divisionCount > 1) {
      const divisionRows = Array.from({ length: values.divisionCount }, (_, i) => ({
        leagueSeasonId: season.id,
        name: `Division ${String.fromCharCode(65 + i)}`,
        sortOrder: i,
      }));
      await tx.insert(divisions).values(divisionRows);
    }

    await tx.insert(leagueMembers).values({
      leagueId: league.id,
      userId: user.id,
      role: "commissioner",
    });

    const commissionerTeamName = getDefaultTeamName(user, profile.displayName);
    const takenSlugs = new Set<string>();
    const teamRows = Array.from({ length: values.teamCount }, (_, index) => {
      const slot = index + 1;
      const isCommissioner = slot === 1;
      const name = isCommissioner ? commissionerTeamName : `Team ${slot}`;
      const teamSlug = allocateUniqueTeamSlug(name, takenSlugs);
      takenSlugs.add(teamSlug);
      return {
        leagueSeasonId: season.id,
        userId: isCommissioner ? user.id : null,
        name,
        publicId: generatePublicId(),
        slug: teamSlug,
        draftSlot: slot,
        autoPickEnabled: DEFAULT_DRAFT_SETTINGS.autoPickEnabled,
        waiverPriority: slot,
        faabRemaining:
          values.waiversEnabled && values.waiverType === "faab"
            ? values.faabBudget
            : null,
      };
    });

    await tx.insert(teams).values(teamRows);

    return { league, season };
  });

  redirect(
    `/leagues/create/success?league=${encodeURIComponent(result.league.publicId)}`,
  );
}

/** Validate invite code and return the join URL path (no membership yet). */
export async function resolveLeagueInviteCode(inviteCode: string): Promise<{
  success: boolean;
  path?: string;
  error?: string;
}> {
  const normalized = inviteCode.trim().toUpperCase();
  if (!normalized) {
    return { success: false, error: "Enter a league code." };
  }

  const league = await getLeagueByInviteCode(normalized);
  if (!league) {
    return { success: false, error: "Invalid league code." };
  }

  return { success: true, path: `/join/${league.inviteCode}` };
}

export async function claimTeam(
  inviteCode: string,
  teamId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSessionUser();
  const profile = await ensureProfile(user);
  if (!profile.onboardedAt) {
    return { success: false, error: "Finish setting up your account first." };
  }

  const league = await getLeagueByInviteCode(inviteCode);
  if (!league) {
    return { success: false, error: "Invalid invite code." };
  }

  const alreadyMember = await isLeagueMember(league.id, user.id);
  if (alreadyMember) {
    redirect(`/league/${league.publicId}`);
  }

  const [season] = await db
    .select()
    .from(leagueSeasons)
    .where(eq(leagueSeasons.leagueId, league.id))
    .orderBy(leagueSeasons.createdAt)
    .limit(1);

  if (!season) {
    return { success: false, error: "League is not ready to accept members yet." };
  }

  if (season.status !== "recruiting") {
    return { success: false, error: "This league is not accepting new members." };
  }

  await ensureSeasonTeamSlots(season.id, season.teamCount, {
    waiversEnabled: season.waiversEnabled,
    waiverType: season.waiverType,
    faabBudget: season.faabBudget,
    autoPickEnabled: season.settings.draft?.autoPickEnabled ?? false,
  });

  const teamName = getDefaultTeamName(
    user,
    profile.displayName ??
      [profile.firstName, profile.lastName].filter(Boolean).join(" "),
  );

  const outcome = await db.transaction(async (tx) => {
    const [lockedSeason] = await tx
      .select()
      .from(leagueSeasons)
      .where(eq(leagueSeasons.id, season.id))
      .for("update");

    if (!lockedSeason || lockedSeason.status !== "recruiting") {
      return { error: "This league is not accepting new members." };
    }

    const [lockedTeam] = await tx
      .select()
      .from(teams)
      .where(
        and(
          eq(teams.id, teamId),
          eq(teams.leagueSeasonId, lockedSeason.id),
          isNull(teams.userId),
        ),
      )
      .for("update");

    if (!lockedTeam) {
      return { error: "That team is no longer available." };
    }

    const [memberCountRow] = await tx
      .select({ value: count() })
      .from(leagueMembers)
      .where(eq(leagueMembers.leagueId, league.id));

    const memberCount = Number(memberCountRow?.value ?? 0);
    if (memberCount >= lockedSeason.teamCount) {
      return { error: "This league is full." };
    }

    const existingSlugs = await tx
      .select({ slug: teams.slug })
      .from(teams)
      .where(eq(teams.leagueSeasonId, lockedSeason.id));
    const takenSlugs = new Set(
      existingSlugs
        .map((row) => row.slug)
        .filter((slug): slug is string => Boolean(slug)),
    );
    const teamSlug = allocateUniqueTeamSlug(teamName, takenSlugs);

    try {
      await tx.insert(leagueMembers).values({
        leagueId: league.id,
        userId: user.id,
        role: "member",
      });

      await tx
        .update(teams)
        .set({
          userId: user.id,
          name: teamName,
          slug: teamSlug,
        })
        .where(eq(teams.id, lockedTeam.id));
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { error: "You are already in this league." };
      }
      throw error;
    }

    return { ok: true as const };
  });

  if ("error" in outcome) {
    return { success: false, error: outcome.error };
  }

  const seasonTeams = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.leagueSeasonId, season.id))
    .orderBy(asc(teams.draftSlot), asc(teams.createdAt));

  await generateScheduleIfLeagueFull({
    leagueSeasonId: season.id,
    teamCount: season.teamCount,
    divisionCount: season.divisionCount,
    regularSeasonEndWeek: season.regularSeasonEndWeek,
    teamIds: seasonTeams.map((team) => team.id),
    storedPlayEachOtherTimes: season.settings.schedule?.playEachOtherTimes,
  });

  redirect(`/league/${league.publicId}`);
}

export async function signOut() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
