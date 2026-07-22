"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { profiles } from "@/db/schema";
import { requireSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isNflTeamAbbrev } from "@/lib/nfl/teams";
import { getProfileByUserId } from "@/lib/queries/profile";

const completeOnboardingSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(40),
  lastName: z.string().trim().min(1, "Last name is required").max(40),
  favouriteNflTeam: z
    .string()
    .trim()
    .refine(isNflTeamAbbrev, "Choose your favourite NFL team."),
});

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;

export async function completeOnboarding(
  input: CompleteOnboardingInput,
): Promise<{ success: boolean; error?: string }> {
  const parsed = completeOnboardingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Check the highlighted fields.",
    };
  }

  const user = await requireSessionUser();
  const profile = await getProfileByUserId(user.id);
  if (profile?.onboardedAt) {
    return { success: true };
  }

  const { firstName, lastName, favouriteNflTeam } = parsed.data;
  const displayName = `${firstName} ${lastName}`.trim();
  const usernameBase =
    displayName.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16) || "user";
  const username = `${usernameBase}_${user.id.replace(/-/g, "").slice(0, 6)}`;

  await db
    .insert(profiles)
    .values({
      id: user.id,
      firstName,
      lastName,
      displayName,
      username,
      favouriteNflTeam,
      onboardedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        firstName,
        lastName,
        displayName,
        favouriteNflTeam,
        onboardedAt: new Date(),
        username: profile?.username ?? username,
      },
    });

  return { success: true };
}

export async function getOnboardingState(): Promise<{
  email: string | null;
  needsOnboarding: boolean;
} | null> {
  try {
    const user = await requireSessionUser();
    const profile = await getProfileByUserId(user.id);
    return {
      email: user.email ?? null,
      needsOnboarding: !profile?.onboardedAt,
    };
  } catch {
    return null;
  }
}

export async function markProfileEnsured() {
  const user = await requireSessionUser();
  const [existing] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  if (existing) {
    return;
  }
  await db.insert(profiles).values({ id: user.id }).onConflictDoNothing();
}
