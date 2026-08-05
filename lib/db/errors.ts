/** Walk Drizzle / driver error wrappers for a Postgres SQLSTATE. */
export function getPostgresErrorCode(error: unknown): string | null {
  let current: unknown = error;
  for (let i = 0; i < 4 && current; i++) {
    if (typeof current === "object" && current !== null && "code" in current) {
      const code = (current as { code: unknown }).code;
      if (code != null && code !== "") {
        return String(code);
      }
    }
    current =
      typeof current === "object" && current !== null && "cause" in current
        ? (current as { cause: unknown }).cause
        : null;
  }
  return null;
}

/** Postgres unique_violation (e.g. concurrent insert on unique index). */
export function isUniqueViolation(error: unknown): boolean {
  return getPostgresErrorCode(error) === "23505";
}
