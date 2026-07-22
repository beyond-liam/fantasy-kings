"use server";

import { and, asc, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import {
  leagueActivity,
  leagueMembers,
  leagues,
  profiles,
  teams,
} from "@/db/schema";
import { requireSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  teamIdentityFormSchema,
  type TeamIdentityFormValues,
} from "@/lib/leagues/team-identity";
import { allocateUniqueTeamSlug } from "@/lib/leagues/utils";
import { getLeagueBySlug, getLeagueSeason } from "@/lib/queries/leagues";
import { getUserTeamForSeason } from "@/lib/queries/watchlist";

type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"name" | "logoUrl", string>>;
};

function fieldErrorsFromZod(
  error: z.ZodError,
): Partial<Record<"name" | "logoUrl", string>> {
  const out: Partial<Record<"name" | "logoUrl", string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (key === "name" || key === "logoUrl") {
      out[key] = issue.message;
    }
  }
  return out;
}

function revalidateTeamSettingsPaths(slug: string) {
  revalidatePath(`/league/${slug}`, "layout");
  revalidatePath("/leagues");
  revalidatePath("/dashboard");
}

async function uniqueSlugExcludingTeam(
  leagueSeasonId: string,
  name: string,
  teamId: string,
) {
  const rows = await db
    .select({ id: teams.id, slug: teams.slug })
    .from(teams)
    .where(eq(teams.leagueSeasonId, leagueSeasonId));
  const taken = new Set(
    rows
      .filter((row) => row.id !== teamId)
      .map((row) => row.slug)
      .filter((slug): slug is string => Boolean(slug)),
  );
  return allocateUniqueTeamSlug(name, taken, teamId);
}

export async function updateTeamIdentity(
  slug: string,
  input: TeamIdentityFormValues,
): Promise<ActionResult> {
  const parsed = teamIdentityFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const values = parsed.data;
  const user = await requireSessionUser();
  const league = await getLeagueBySlug(slug);
  if (!league) {
    return { success: false, error: "League not found." };
  }

  const season = await getLeagueSeason(league.id);
  if (!season) {
    return { success: false, error: "League season not found." };
  }

  const team = await getUserTeamForSeason(season.id, user.id);
  if (!team) {
    return { success: false, error: "Team not found." };
  }

  const nextLogoUrl =
    values.logoMode === "remove"
      ? null
      : values.logoMode === "url" || values.logoMode === "upload"
        ? values.logoUrl.trim()
        : (team.logoUrl ?? null);

  const name = values.name.trim();
  const nextSlug =
    name !== team.name
      ? await uniqueSlugExcludingTeam(season.id, name, team.id)
      : null;

  await db
    .update(teams)
    .set({
      name,
      logoUrl: nextLogoUrl,
      ...(nextSlug ? { slug: nextSlug } : {}),
    })
    .where(eq(teams.id, team.id));

  revalidateTeamSettingsPaths(league.publicId);
  return { success: true };
}

/**
 * Owner leaves the league. Vacates their team slot (same as commissioner remove).
 * If they are primary commissioner, commissionership transfers to another member.
 */
export async function dropOutOfLeague(slug: string): Promise<ActionResult> {
  const user = await requireSessionUser();
  const league = await getLeagueBySlug(slug);
  if (!league) {
    return { success: false, error: "League not found." };
  }

  const season = await getLeagueSeason(league.id);
  if (!season) {
    return { success: false, error: "League season not found." };
  }

  const [membership] = await db
    .select({
      role: leagueMembers.role,
      displayName: profiles.displayName,
    })
    .from(leagueMembers)
    .leftJoin(profiles, eq(leagueMembers.userId, profiles.id))
    .where(
      and(
        eq(leagueMembers.leagueId, league.id),
        eq(leagueMembers.userId, user.id),
      ),
    )
    .limit(1);

  if (!membership) {
    return { success: false, error: "You are not a member of this league." };
  }

  const isPrimary = league.commissionerId === user.id;
  let successorId: string | null = null;

  if (isPrimary) {
    const remaining = await db
      .select({
        userId: leagueMembers.userId,
        role: leagueMembers.role,
        joinedAt: leagueMembers.joinedAt,
      })
      .from(leagueMembers)
      .where(
        and(
          eq(leagueMembers.leagueId, league.id),
          ne(leagueMembers.userId, user.id),
        ),
      )
      .orderBy(asc(leagueMembers.joinedAt));

    const coCommissioner = remaining.find(
      (member) => member.role === "co_commissioner",
    );
    successorId = coCommissioner?.userId ?? remaining[0]?.userId ?? null;
  }

  const team = await getUserTeamForSeason(season.id, user.id);
  const displayName = membership.displayName?.trim() || "Owner";

  if (isPrimary && !successorId) {
    return {
      success: false,
      error: "Assign another commissioner before leaving.",
    };
  }

  await db.transaction(async (tx) => {
    if (team) {
      await tx
        .update(teams)
        .set({ userId: null })
        .where(eq(teams.id, team.id));
    }

    if (isPrimary && successorId) {
      await tx
        .update(leagues)
        .set({ commissionerId: successorId })
        .where(eq(leagues.id, league.id));

      await tx
        .update(leagueMembers)
        .set({ role: "commissioner" })
        .where(
          and(
            eq(leagueMembers.leagueId, league.id),
            eq(leagueMembers.userId, successorId),
          ),
        );
    }

    await tx
      .delete(leagueMembers)
      .where(
        and(
          eq(leagueMembers.leagueId, league.id),
          eq(leagueMembers.userId, user.id),
        ),
      );

    await tx.insert(leagueActivity).values({
      leagueSeasonId: season.id,
      type: "member_removed",
      teamId: team?.id ?? null,
      actorUserId: user.id,
      summary: `${displayName} left the league.`,
      metadata: {
        removalReason: "dropout",
        removedUserId: user.id,
        removedDisplayName: displayName,
        teamName: team?.name ?? null,
      },
    });
  });

  revalidateTeamSettingsPaths(league.publicId);
  redirect("/leagues");
}
