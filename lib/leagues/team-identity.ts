import { z } from "zod";

import { validateImageUrl } from "@/lib/ui/image-url";

export type TeamIdentityFormValues = {
  name: string;
  logoMode: "keep" | "upload" | "url" | "remove";
  logoUrl: string;
};

export const teamIdentityFormSchema = z
  .object({
    name: z.string().trim().min(2, "Team name is required").max(40),
    logoMode: z.enum(["keep", "upload", "url", "remove"]),
    logoUrl: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    if (data.logoMode !== "url" && data.logoMode !== "upload") return;

    if (data.logoMode === "upload") {
      if (!data.logoUrl.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["logoUrl"],
          message: "Choose an image to upload",
        });
      }
      return;
    }

    // URL mode - validate HTTPS and optional Supabase allowlist
    const validation = validateImageUrl(data.logoUrl, {
      allowlistSupabase: false, // Allow external HTTPS URLs for flexibility
    });

    if (!validation.valid) {
      ctx.addIssue({
        code: "custom",
        path: ["logoUrl"],
        message: validation.error,
      });
    }
  });
