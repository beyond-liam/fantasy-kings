"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { draftGrades } from "@/db/schema";
import { db } from "@/lib/db";
import { loadLeagueMemberTeamContext } from "@/lib/leagues/action-context";

const gradeIdSchema = z.string().uuid();

export async function markDraftGradeSeen(
  slug: string,
  gradeId: string,
): Promise<{ success: boolean; error?: string }> {
  const parsed = gradeIdSchema.safeParse(gradeId);
  if (!parsed.success) {
    return { success: false, error: "Invalid grade." };
  }

  const context = await loadLeagueMemberTeamContext(slug);
  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { team, league } = context;

  const updated = await db
    .update(draftGrades)
    .set({ seenAt: new Date() })
    .where(
      and(
        eq(draftGrades.id, parsed.data),
        eq(draftGrades.teamId, team.id),
        isNull(draftGrades.seenAt),
      ),
    )
    .returning({ id: draftGrades.id });

  if (updated.length === 0) {
    // Already seen or not owned — treat as success so the dialog can close.
    return { success: true };
  }

  revalidatePath(`/league/${league.publicId}`);
  revalidatePath(`/league/${league.publicId}/draft`);
  revalidatePath(`/league/${league.publicId}/team`);
  return { success: true };
}
