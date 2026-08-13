/**
 * Preseason Sleeper projections are often ADP-only (no pts).
 * Fall back to regular-season week 1 projections for display.
 */

export const PRESEASON_PROJECTION_FALLBACK_WEEK = 1;
export const PRESEASON_PROJECTION_FALLBACK_SEASON_TYPE = "regular" as const;

export function needsPreseasonProjectionFallback(
  seasonType: string | undefined,
): boolean {
  return seasonType === "pre";
}

function hasPositiveProjectedPoints(
  pointsByPlayerId: Map<string, number | null>,
): boolean {
  for (const pts of pointsByPlayerId.values()) {
    if (pts != null && Number.isFinite(pts) && pts > 0) {
      return true;
    }
  }
  return false;
}

/** Prefer primary pts; fill missing/null from fallback. */
export function mergeProjectedPointsByPlayerId(
  primary: Map<string, number | null>,
  fallback: Map<string, number | null>,
): Map<string, number | null> {
  if (fallback.size === 0) {
    return primary;
  }
  const out = new Map(primary);
  for (const [playerId, fallbackPts] of fallback) {
    const current = out.get(playerId);
    if (
      (current == null || !Number.isFinite(current)) &&
      fallbackPts != null &&
      Number.isFinite(fallbackPts)
    ) {
      out.set(playerId, fallbackPts);
    }
  }
  return out;
}

/**
 * If preseason projections have no positive pts (typical ADP-only rows),
 * use the regular-season fallback map wholesale; otherwise merge gaps.
 */
export function resolvePreseasonProjectedPoints(
  primary: Map<string, number | null>,
  fallback: Map<string, number | null>,
): Map<string, number | null> {
  if (fallback.size === 0) {
    return primary;
  }
  if (!hasPositiveProjectedPoints(primary)) {
    return new Map(fallback);
  }
  return mergeProjectedPointsByPlayerId(primary, fallback);
}
