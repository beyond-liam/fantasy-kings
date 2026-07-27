/**
 * Validates that an image URL uses HTTPS and optionally allowlists Supabase storage.
 * Rejects http:// and javascript: schemes for security.
 */

/**
 * Returns the hostname from NEXT_PUBLIC_SUPABASE_URL if available.
 * Used to allowlist Supabase storage URLs.
 */
function getSupabaseHostname(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const url = new URL(supabaseUrl);
    return url.hostname;
  } catch {
    return null;
  }
}

export type ImageUrlValidation = {
  valid: true;
} | {
  valid: false;
  error: string;
};

/**
 * Validates an image URL for use in logos and avatars.
 * 
 * Requirements:
 * - Must use https:// scheme (rejects http:// and javascript:)
 * - Optionally allowlists Supabase storage hostname from NEXT_PUBLIC_SUPABASE_URL
 * 
 * @param url - The URL to validate
 * @param options - Validation options
 * @returns Validation result with error message if invalid
 */
export function validateImageUrl(
  url: string,
  options: { allowlistSupabase?: boolean } = { allowlistSupabase: true }
): ImageUrlValidation {
  const trimmed = url.trim();

  if (!trimmed) {
    return { valid: false, error: "URL is required" };
  }

  // Reject javascript: and other dangerous schemes
  if (/^javascript:/i.test(trimmed)) {
    return { valid: false, error: "Invalid URL scheme" };
  }

  // Require https:// scheme
  if (!/^https:\/\//i.test(trimmed)) {
    return { valid: false, error: "Image URL must use HTTPS" };
  }

  // Optional: Allowlist Supabase storage
  if (options.allowlistSupabase) {
    const supabaseHostname = getSupabaseHostname();
    if (supabaseHostname) {
      try {
        const parsedUrl = new URL(trimmed);
        if (parsedUrl.hostname !== supabaseHostname) {
          return {
            valid: false,
            error: `Image URL must be from ${supabaseHostname}`,
          };
        }
      } catch {
        return { valid: false, error: "Invalid URL format" };
      }
    }
  }

  return { valid: true };
}

/**
 * Returns true if the URL passes HTTPS-only validation.
 * Convenience function for zod superRefine.
 */
export function isValidImageUrl(
  url: string,
  options?: { allowlistSupabase?: boolean }
): boolean {
  return validateImageUrl(url, options).valid;
}
