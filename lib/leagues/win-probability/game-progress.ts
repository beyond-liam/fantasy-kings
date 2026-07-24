/**
 * Live win-probability helpers.
 *
 * Shipped: pace blend, injury/out zeroing, soft DNP, OT ≈ done, calibrated
 * position σ priors (`calibration.ts`). Mid-game accuracy still tracks how
 * fresh `player_scores` stats are (Sleeper sync); ESPN player box scores are
 * the next feed upgrade.
 */

/** Regulation game length used for linear remaining-projection (minutes). */
export const NFL_REGULATION_MINUTES = 60;
export const NFL_QUARTER_MINUTES = 15;

export type GameClockStatus = "pre" | "in" | "post";

export type GameProgress = {
  status: GameClockStatus;
  /** 0 = kickoff, 1 = regulation complete (or post). */
  fractionPlayed: number;
};

/** Parse ESPN `displayClock` values like `7:32` / `0:00` into minutes. */
export function parseDisplayClockMinutes(
  displayClock: string | null | undefined,
): number {
  if (!displayClock) {
    return 0;
  }
  const match = /^(\d+):(\d{2})$/.exec(displayClock.trim());
  if (!match) {
    return 0;
  }
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return 0;
  }
  return minutes + seconds / 60;
}

/**
 * Estimate how far through regulation a live/final game is.
 * OT is treated as fully played for remaining-projection purposes.
 */
export function resolveGameProgress(input: {
  status: GameClockStatus;
  period?: number | null;
  displayClock?: string | null;
}): GameProgress {
  if (input.status === "pre") {
    return { status: "pre", fractionPlayed: 0 };
  }
  if (input.status === "post") {
    return { status: "post", fractionPlayed: 1 };
  }

  const period = input.period ?? 1;
  if (period > 4) {
    // OT: almost complete — stop projecting remaining regulation points, but
    // keep a tiny residual so late actuals can still move WP slightly.
    return { status: "in", fractionPlayed: 0.98 };
  }

  const clockLeft = parseDisplayClockMinutes(input.displayClock);
  const quarterElapsed = Math.max(0, NFL_QUARTER_MINUTES - clockLeft);
  const minutesPlayed =
    Math.max(0, period - 1) * NFL_QUARTER_MINUTES + quarterElapsed;
  const fractionPlayed = Math.min(
    1,
    Math.max(0, minutesPlayed / NFL_REGULATION_MINUTES),
  );

  return { status: "in", fractionPlayed };
}
