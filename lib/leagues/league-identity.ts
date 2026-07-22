import { z } from "zod";

import { slugifyLeagueName } from "@/lib/leagues/utils";

export type LeagueDivisionInput = {
  id: string;
  name: string;
};

export type LeagueIdentityFormValues = {
  name: string;
  logoMode: "keep" | "upload" | "url" | "remove";
  logoUrl: string;
  divisions: LeagueDivisionInput[];
};

export const leagueIdentityFormSchema = z
  .object({
    name: z.string().trim().min(2, "League name is required").max(60),
    logoMode: z.enum(["keep", "upload", "url", "remove"]),
    logoUrl: z.string().trim(),
    divisions: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1, "Division name is required").max(40),
      }),
    ),
  })
  .refine(
    (data) => {
      const slug = slugifyLeagueName(data.name);
      return slug.length >= 2 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
    },
    {
      message: "League name must include letters or numbers",
      path: ["name"],
    },
  )
  .superRefine((data, ctx) => {
    if (data.logoMode !== "url" && data.logoMode !== "upload") return;
    if (/^https?:\/\/.+/i.test(data.logoUrl.trim())) return;
    ctx.addIssue({
      code: "custom",
      path: ["logoUrl"],
      message:
        data.logoMode === "upload"
          ? "Choose an image to upload"
          : "Enter a valid image URL",
    });
  });

