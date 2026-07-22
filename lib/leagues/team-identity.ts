import { z } from "zod";

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
