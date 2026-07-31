/**
 * Deep equality for JSON-shaped values, ignoring object key order.
 *
 * Settings forms compare local edits against values that have round-tripped
 * through a `jsonb` column, and Postgres does not preserve key order.
 */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => jsonEqual(item, b[index]));
  }

  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    return false;
  }

  const left = definedEntries(a as Record<string, unknown>);
  const right = b as Record<string, unknown>;

  if (left.length !== definedEntries(right).length) {
    return false;
  }

  return left.every(([key, value]) => jsonEqual(value, right[key]));
}

function definedEntries(value: Record<string, unknown>) {
  return Object.entries(value).filter(([, entry]) => entry !== undefined);
}
