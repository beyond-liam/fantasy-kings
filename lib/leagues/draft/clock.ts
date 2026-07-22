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

export function secondsUntil(expiresAt: Date, now = new Date()): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));
}
