"use server";

import { z } from "zod";

import { requireSessionUser } from "@/lib/auth/session";
import { userHasEmailIdentity } from "@/lib/auth/email-identity";
import { createClient } from "@/lib/supabase/server";

const MIN_PASSWORD_LENGTH = 8;

const updatePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      ),
    confirmPassword: z.string(),
    requireCurrent: z.boolean(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine(
    (value) =>
      !value.requireCurrent || Boolean(value.currentPassword?.trim()),
    {
      message: "Enter your current password.",
      path: ["currentPassword"],
    },
  );

export type UpdateAccountPasswordInput = z.infer<typeof updatePasswordSchema>;

type UpdatePasswordResult = {
  success: boolean;
  error?: string;
};

export async function updateAccountPassword(
  input: UpdateAccountPasswordInput,
): Promise<UpdatePasswordResult> {
  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Check the password fields.",
    };
  }

  const user = await requireSessionUser();
  const email = user.email?.trim();
  if (!email) {
    return { success: false, error: "Your account has no email address." };
  }

  const { currentPassword, newPassword, requireCurrent } = parsed.data;
  const supabase = await createClient();

  // Don't trust the client flag alone — require current whenever email identity exists.
  const hasEmailIdentity = userHasEmailIdentity(user);
  const mustVerify = hasEmailIdentity || requireCurrent;

  if (mustVerify) {
    const current = currentPassword?.trim() ?? "";
    if (!current) {
      return { success: false, error: "Enter your current password." };
    }
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (verifyError) {
      return { success: false, error: "Current password is incorrect." };
    }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    const normalized = error.message.toLowerCase();
    if (
      normalized.includes("password should be") ||
      normalized.includes("password is too short") ||
      normalized.includes("weak password")
    ) {
      return {
        success: false,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      };
    }
    return { success: false, error: error.message };
  }

  return { success: true };
}
