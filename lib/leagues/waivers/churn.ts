import type { WaiverWireSettings } from "@/db/schema/league-seasons";
import {
  getLastProcessInstantUtc,
  getNextProcessInstantUtc,
} from "@/lib/leagues/waivers/calendar";

export type ChurnCutDecision =
  | { allow: true; skipWaivers: boolean }
  | { allow: false; error: string };

/**
 * Apply churn-prevention rules at cut time.
 * - return_to_fa: players acquired since the last process clear as free agents
 * - block_late_drops: block cuts that would not clear before the next process
 * - none: always waive normally
 */
export function resolveChurnCut(input: {
  churnPrevention: WaiverWireSettings["churnPrevention"];
  processDays: WaiverWireSettings["processDays"];
  dropWaiverHours: number;
  acquiredAt: Date | null;
  now?: Date;
}): ChurnCutDecision {
  const now = input.now ?? new Date();

  if (input.churnPrevention === "none") {
    return { allow: true, skipWaivers: false };
  }

  if (input.churnPrevention === "return_to_fa") {
    const last = getLastProcessInstantUtc(input.processDays, now);
    const acquired = input.acquiredAt;
    if (acquired && last && acquired.getTime() >= last.getTime()) {
      return { allow: true, skipWaivers: true };
    }
    return { allow: true, skipWaivers: false };
  }

  // block_late_drops
  const next = getNextProcessInstantUtc(input.processDays, now);
  if (!next) {
    return { allow: true, skipWaivers: false };
  }
  const clearsAt = new Date(
    now.getTime() + input.dropWaiverHours * 60 * 60 * 1000,
  );
  if (clearsAt >= next) {
    return {
      allow: false,
      error:
        "Too close to the next waiver process to drop this player. Other managers would not have time to claim.",
    };
  }
  return { allow: true, skipWaivers: false };
}
