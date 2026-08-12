import type { WaiverWireSettings } from "@/db/schema/league-seasons";
import {
  getNextProcessInstantUtc,
  getWaiverProcessDays,
  isClaimEligibleForProcess,
  isWeeklyProcessInstant,
} from "@/lib/leagues/waivers/calendar";
import { isEligibleForDailyProcess } from "@/lib/leagues/waivers/daily-drops";

/**
 * Next process instant that will adjudicate this claim (deadline + daily routing).
 * Played / in-progress players skip daily runs and wait for the weekly process.
 */
export function resolveClaimProcessInstant(input: {
  wire: Pick<WaiverWireSettings, "processDays" | "dailyDropProcessing">;
  createdAt: Date;
  kickoff: Date | null;
  now?: Date;
}): Date | null {
  const now = input.now ?? new Date();
  const processDays = getWaiverProcessDays(input.wire);
  let cursor = now;

  for (let attempt = 0; attempt < 21; attempt++) {
    const process = getNextProcessInstantUtc(processDays, cursor);
    if (!process) {
      return null;
    }

    if (!isClaimEligibleForProcess(input.createdAt, process)) {
      cursor = new Date(process.getTime() + 1000);
      continue;
    }

    if (
      input.wire.dailyDropProcessing &&
      !isWeeklyProcessInstant(input.wire, process)
    ) {
      if (
        !isEligibleForDailyProcess({
          kickoff: input.kickoff,
          processInstant: process,
        })
      ) {
        cursor = new Date(process.getTime() + 1000);
        continue;
      }
    }

    return process;
  }

  return null;
}
