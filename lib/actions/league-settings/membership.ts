"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  leagueActivity,
  leagueMembers,
  profiles,
  teams,
} from "@/db/schema";
import { requireSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  isOwnerRemovalReason,
  ownerRemovalReasonLabel,
  type OwnerRemovalReason,
} from "@/lib/leagues/membership";
import { formatPersonName } from "@/lib/account/person-name";
import { isPrimaryCommissioner } from "@/lib/queries/leagues";

import {
  getCommissionerSeason,
  revalidateSettingsPaths,
  type ActionResult,
} from "./_shared";

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
    return { success: false, error: "You can't remove yourself." };
  }

  const [targetMember] = await db
    .select({
      userId: leagueMembers.userId,
      role: leagueMembers.role,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      username: profiles.username,
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
      error: "The commissioner can't be removed. Step down first.",
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
  const displayName = formatPersonName(targetMember);

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
