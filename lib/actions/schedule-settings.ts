"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { profiles } from "@/db/schema";
import {
  scheduleSettingsSchema,
  type ScheduleSettingsValues,
} from "@/lib/account/schedule-settings";
import { requireSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

type ActionResult = {
  success: boolean;
  error?: string;
};

export async function updateScheduleSettings(
  input: ScheduleSettingsValues,
): Promise<ActionResult> {
  const parsed = scheduleSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid schedule settings." };
  }

  const user = await requireSessionUser();

  await db
    .update(profiles)
    .set({
      includePreseason: parsed.data.includePreseason,
      preseasonStartWeek: parsed.data.preseasonStartWeek,
    })
    .where(eq(profiles.id, user.id));

  revalidatePath("/settings");
  revalidatePath("/scores");
  return { success: true };
}
