import { eq } from "drizzle-orm";
import { cache } from "react";

import { profiles } from "@/db/schema";
import { db } from "@/lib/db";

export const getProfileByUserId = cache(async (userId: string) => {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return profile ?? null;
});
