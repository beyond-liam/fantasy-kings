import { eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/lib/db";
import { profiles } from "@/db/schema/users";
import { createClient } from "@/lib/supabase/server";

export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function ensureProfile(user: {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string; name?: string };
}) {
  await db
    .insert(profiles)
    .values({
      id: user.id,
    })
    .onConflictDoNothing();

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  return (
    profile ?? {
      id: user.id,
      displayName: null,
      username: null,
      firstName: null,
      lastName: null,
      favouriteNflTeam: null,
      avatarUrl: null,
      onboardedAt: null,
      createdAt: new Date(),
    }
  );
}
