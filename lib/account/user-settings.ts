import { z } from "zod";

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
    if (/^https?:\/\/.+/i.test(data.avatarUrl.trim())) return;
    ctx.addIssue({
      code: "custom",
      path: ["avatarUrl"],
      message:
        data.avatarMode === "upload"
          ? "Choose an image to upload"
          : "Enter a valid image URL",
    });
  });
