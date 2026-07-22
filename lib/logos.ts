import { createClient } from "@/lib/supabase/client";

export const LOGO_BUCKET = "logos";
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type LogoKind = "team" | "league" | "avatar";

export type LogoUploadResult =
  | { success: true; url: string }
  | { success: false; error: string };

function extensionForFile(file: File) {
  const fromMime = EXT_BY_MIME[file.type];
  if (fromMime) return fromMime;
  const nameExt = file.name.split(".").pop()?.toLowerCase();
  if (nameExt === "jpg" || nameExt === "jpeg") return "jpg";
  if (nameExt === "png" || nameExt === "webp" || nameExt === "gif") {
    return nameExt;
  }
  return null;
}

export function validateLogoFile(file: File): string | null {
  if (!ALLOWED_MIME.has(file.type)) {
    return "Use a JPEG, PNG, WebP, or GIF image.";
  }
  if (file.size > LOGO_MAX_BYTES) {
    return "Image must be 2MB or smaller.";
  }
  if (!extensionForFile(file)) {
    return "Could not determine image type.";
  }
  return null;
}

/** Browser upload to the public `logos` bucket. Path: `{userId}/{kind}/{uuid}.ext`. */
export async function uploadLogoFile(
  file: File,
  kind: LogoKind,
): Promise<LogoUploadResult> {
  const validationError = validateLogoFile(file);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const ext = extensionForFile(file)!;
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: "Sign in to upload a logo." };
  }

  const path = `${user.id}/${kind}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    return {
      success: false,
      error: uploadError.message || "Could not upload image.",
    };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);

  return { success: true, url: publicUrl };
}
