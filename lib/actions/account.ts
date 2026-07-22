"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import {
  leagueMembers,
  leagues,
  profiles,
  teams,
} from "@/db/schema";
import {
  userSettingsFormSchema,
  type UserSettingsFormValues,
} from "@/lib/account/user-settings";
import { getSessionUser, requireSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getProfileByUserId } from "@/lib/queries/profile";
import { createClient } from "@/lib/supabase/server";

type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Partial<
    Record<"email" | "username" | "firstName" | "lastName" | "avatarUrl", string>
  >;
  emailPendingConfirm?: boolean;
};

export async function getSessionAccountSummary(): Promise<{
  email: string | null;
  avatarUrl: string | null;
  username: string | null;
} | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const profile = await getProfileByUserId(user.id);
  return {
    email: user.email ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    username: profile?.username ?? profile?.displayName ?? null,
  };
}

function fieldErrorsFromZod(
  error: z.ZodError,
): NonNullable<ActionResult["fieldErrors"]> {
  const out: NonNullable<ActionResult["fieldErrors"]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (
      key === "email" ||
      key === "username" ||
      key === "firstName" ||
      key === "lastName" ||
      key === "avatarUrl"
    ) {
      out[key] = issue.message;
    }
  }
  return out;
}

export async function updateUserSettings(
  input: UserSettingsFormValues,
): Promise<ActionResult> {
  const parsed = userSettingsFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const user = await requireSessionUser();
  const values = parsed.data;
  const username = values.username.trim();

  const [taken] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.username, username), ne(profiles.id, user.id)))
    .limit(1);

  if (taken) {
    return {
      success: false,
      error: "That username is already taken.",
      fieldErrors: { username: "That username is already taken." },
    };
  }

  const [existing] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  if (!existing) {
    return { success: false, error: "Profile not found." };
  }

  const nextAvatarUrl =
    values.avatarMode === "remove"
      ? null
      : values.avatarMode === "url" || values.avatarMode === "upload"
        ? values.avatarUrl.trim()
        : (existing.avatarUrl ?? null);

  await db
    .update(profiles)
    .set({
      username,
      displayName: username,
      firstName: values.firstName.trim() || null,
      lastName: values.lastName.trim() || null,
      avatarUrl: nextAvatarUrl,
    })
    .where(eq(profiles.id, user.id));

  let emailPendingConfirm = false;
  const nextEmail = values.email.trim().toLowerCase();
  const currentEmail = user.email?.toLowerCase() ?? "";

  if (nextEmail && nextEmail !== currentEmail) {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ email: nextEmail });
    if (error) {
      return {
        success: false,
        error: error.message || "Could not update email.",
        fieldErrors: { email: error.message || "Could not update email." },
      };
    }
    emailPendingConfirm = true;
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/leagues");
  return { success: true, emailPendingConfirm };
}

/**
 * Deletes the account: removes leagues they commission, vacates other teams,
 * deletes the profile, then removes the auth user.
 */
export async function deleteAccount(): Promise<ActionResult> {
  const user = await requireSessionUser();
  const userId = user.id;

  const commissioned = await db
    .select({ id: leagues.id })
    .from(leagues)
    .where(eq(leagues.commissionerId, userId));

  await db.transaction(async (tx) => {
    for (const league of commissioned) {
      await tx.delete(leagues).where(eq(leagues.id, league.id));
    }

    const ownedTeams = await tx
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.userId, userId));

    for (const team of ownedTeams) {
      await tx
        .update(teams)
        .set({ userId: null })
        .where(eq(teams.id, team.id));
    }

    await tx.delete(leagueMembers).where(eq(leagueMembers.userId, userId));
    await tx.delete(profiles).where(eq(profiles.id, userId));
  });

  try {
    await db.execute(sql`delete from auth.users where id = ${userId}`);
  } catch {
    // App data is gone; auth row may need dashboard cleanup if RLS blocks this.
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/leagues");
  redirect("/login");
}
