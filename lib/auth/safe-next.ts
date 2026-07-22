const DEFAULT_NEXT = "/dashboard";

/** Allow only same-origin relative paths: `/…` but not `//…`. */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_NEXT;
  const value = raw.trim();
  if (!value.startsWith("/")) return DEFAULT_NEXT;
  if (value.startsWith("//")) return DEFAULT_NEXT;
  if (value.includes("://")) return DEFAULT_NEXT;
  return value;
}
