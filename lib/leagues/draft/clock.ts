/** Absolute expiry for the current pick, or null when the clock is unlimited. */
export function computeTurnExpiresAt(
  now: Date,
  pickTimeLimitSeconds: number,
): Date | null {
  if (pickTimeLimitSeconds <= 0) {
    return null;
  }
  return new Date(now.getTime() + pickTimeLimitSeconds * 1000);
}

/** Clock-exempt seats expire immediately so autodraft can drain without waiting. */
export function resolveTurnExpiresAt(input: {
  now: Date;
  pickTimeLimitSeconds: number;
  clockExempt: boolean;
}): Date | null {
  if (input.pickTimeLimitSeconds <= 0) {
    return null;
  }
  if (input.clockExempt) {
    return input.now;
  }
  return computeTurnExpiresAt(input.now, input.pickTimeLimitSeconds);
}

export function secondsUntil(expiresAt: Date, now = new Date()): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));
}

/**
 * Display remaining pick-clock time.
 * Live clocks stay compact (`90s` / `1:30`); email/slow windows use `H:MM:SS`.
 */
export function formatPickClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}
