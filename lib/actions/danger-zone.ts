"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  leagueMembers,
  leagues,
  leagueSeasons,
  rosterPlayers,
  teams,
} from "@/db/schema";
import { requireSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  getLeagueBySlug,
  isLeagueCommissioner,
  isPrimaryCommissioner,
} from "@/lib/queries/leagues";

type ActionResult = {
  success: boolean;
  error?: string;
};

async function getCommissionerSeason(slug: string) {
  const user = await requireSessionUser();
  const league = await getLeagueBySlug(slug);

  if (!league) {
    return { error: "League not found." as const };
  }

  const isCommissioner = await isLeagueCommissioner(league.id, user.id);
  if (!isCommissioner) {
    return {
      error: "Only the commissioner can perform this action." as const,
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

  return { season, league, user };
}

function revalidateLeaguePaths(slug: string) {
  revalidatePath(`/league/${slug}/settings`);
  revalidatePath(`/league/${slug}`);
  revalidatePath(`/league/${slug}/team`);
  revalidatePath(`/league/${slug}/players`);
  revalidatePath(`/league/${slug}/matchup`);
  revalidatePath("/leagues");
  revalidatePath("/dashboard");
}

/** Clear every rostered/waived player on one team. */
export async function clearTeamRoster(
  slug: string,
  teamId: string,
): Promise<ActionResult> {
  if (!teamId) {
    return { success: false, error: "Select a team." };
  }

  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;
  const [team] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.leagueSeasonId, season.id)))
    .limit(1);

  if (!team) {
    return { success: false, error: "Team not found in this league." };
  }

  await db.delete(rosterPlayers).where(eq(rosterPlayers.teamId, teamId));

  revalidateLeaguePaths(slug);
  return { success: true };
}

/** Clear rosters for every team in the current season. */
export async function clearAllRosters(slug: string): Promise<ActionResult> {
  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { season } = result;
  const seasonTeams = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.leagueSeasonId, season.id));

  if (seasonTeams.length > 0) {
    await db.delete(rosterPlayers).where(
      inArray(
        rosterPlayers.teamId,
        seasonTeams.map((team) => team.id),
      ),
    );
  }

  revalidateLeaguePaths(slug);
  return { success: true };
}

/**
 * Primary commissioner steps down.
 * Pass successorUserId when no co-commissioner exists.
 * With co-commissioners, omit successor to auto-promote the earliest co-commish.
 */
export async function stepDownAsCommissioner(
  slug: string,
  successorUserId?: string | null,
): Promise<ActionResult> {
  const result = await getCommissionerSeason(slug);
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const { league, user } = result;
  const isPrimary = await isPrimaryCommissioner(league.id, user.id);
  if (!isPrimary) {
    return {
      success: false,
      error: "Only the primary commissioner can step down.",
    };
  }

  const members = await db
    .select({
      userId: leagueMembers.userId,
      role: leagueMembers.role,
      joinedAt: leagueMembers.joinedAt,
    })
    .from(leagueMembers)
    .where(eq(leagueMembers.leagueId, league.id))
    .orderBy(asc(leagueMembers.joinedAt));

  const coCommissioners = members.filter(
    (member) => member.role === "co_commissioner",
  );

  let nextCommissionerId = successorUserId?.trim() || null;

  if (coCommissioners.length > 0) {
    if (
      nextCommissionerId &&
      !coCommissioners.some((member) => member.userId === nextCommissionerId)
    ) {
      return {
        success: false,
        error: "Choose a co-commissioner to take over.",
      };
    }
    nextCommissionerId = nextCommissionerId ?? coCommissioners[0]!.userId;
  } else {
    if (!nextCommissionerId) {
      return {
        success: false,
        error: "Select a new commissioner before stepping down.",
      };
    }
    const successor = members.find(
      (member) => member.userId === nextCommissionerId,
    );
    if (!successor || successor.userId === user.id) {
      return {
        success: false,
        error: "Select another league member to become commissioner.",
      };
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(leagues)
      .set({ commissionerId: nextCommissionerId! })
      .where(eq(leagues.id, league.id));

    await tx
      .update(leagueMembers)
      .set({ role: "member" })
      .where(
        and(
          eq(leagueMembers.leagueId, league.id),
          eq(leagueMembers.userId, user.id),
        ),
      );

    await tx
      .update(leagueMembers)
      .set({ role: "commissioner" })
      .where(
        and(
          eq(leagueMembers.leagueId, league.id),
          eq(leagueMembers.userId, nextCommissionerId!),
        ),
      );
  });

  revalidateLeaguePaths(slug);
  return { success: true };
}

export async function deleteLeague(slug: string): Promise<ActionResult> {
  const user = await requireSessionUser();
  const league = await getLeagueBySlug(slug);

  if (!league) {
    return { success: false, error: "League not found." };
  }

  const isPrimary = await isPrimaryCommissioner(league.id, user.id);
  if (!isPrimary) {
    return {
      success: false,
      error: "Only the primary commissioner can delete this league.",
    };
  }

  await db.delete(leagues).where(eq(leagues.id, league.id));

  revalidatePath("/leagues");
  revalidatePath("/dashboard");
  redirect("/leagues");
}
