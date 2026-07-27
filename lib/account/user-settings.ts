import { z } from "zod";

import { validateImageUrl } from "@/lib/ui/image-url";

export type UserSettingsFormValues = {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarMode: "keep" | "upload" | "url" | "remove";
  avatarUrl: string;
};

export const userSettingsFormSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email"),
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .max(24, "Username must be at most 24 characters")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Username can only use letters, numbers, and underscores",
      ),
    firstName: z.string().trim().max(40, "First name is too long"),
    lastName: z.string().trim().max(40, "Last name is too long"),
    avatarMode: z.enum(["keep", "upload", "url", "remove"]),
    avatarUrl: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    if (data.avatarMode !== "url" && data.avatarMode !== "upload") return;

    if (data.avatarMode === "upload") {
      if (!data.avatarUrl.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["avatarUrl"],
          message: "Choose an image to upload",
        });
      }
      return;
    }

    // URL mode - validate HTTPS and optional Supabase allowlist
    const validation = validateImageUrl(data.avatarUrl, {
      allowlistSupabase: false, // Allow external HTTPS URLs for flexibility
    });

    if (!validation.valid) {
      ctx.addIssue({
        code: "custom",
        path: ["avatarUrl"],
        message: validation.error,
      });
    }
  });
