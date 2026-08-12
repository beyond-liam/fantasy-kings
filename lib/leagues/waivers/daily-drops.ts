import type { WaiverWireSettings } from "@/db/schema/league-seasons";

/**
 * Daily-eligible: next process fires before this player's kickoff.
 * Already started, or kickoff at/before process → weekly pool.
 * No kickoff (bye / not on the slate) → daily.
 */
export function isEligibleForDailyProcess(input: {
  kickoff: Date | null;
  processInstant: Date;
  alreadyStarted?: boolean;
}): boolean {
  if (input.alreadyStarted) {
    return false;
  }
  if (!input.kickoff || !Number.isFinite(input.kickoff.getTime())) {
    return true;
  }
  return input.kickoff.getTime() > input.processInstant.getTime();
}

/** Dropped players clear to free agency after the configured 24/48h window. */
export function getDropWaiverClearsAt(input: {
  wire: Pick<WaiverWireSettings, "dropWaiverHours">;
  now?: Date;
}): Date {
  const now = input.now ?? new Date();
  return new Date(
    now.getTime() + input.wire.dropWaiverHours * 60 * 60 * 1000,
  );
}
