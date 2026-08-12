import { getNextFantasyWeekStartUtc } from "@/lib/leagues/waivers/calendar";
import { hasNflTeamStarted } from "@/lib/leagues/waivers/game-lock";

/** True when any involved NFL team has already kicked off this week. */
export function tradeNeedsWeekEndHold(input: {
  nflTeams: Array<string | null | undefined>;
  startedTeams: Set<string>;
}): boolean {
  return input.nflTeams.some((team) =>
    hasNflTeamStarted(team, input.startedTeams),
  );
}

/** Hold until the next fantasy week start (Wed 00:01 UTC). */
export function reviewEndsAtForWeekHold(now: Date = new Date()): Date {
  return getNextFantasyWeekStartUtc(now);
}

/**
 * Upcoming kickoff within the review window — used for the 24h review warning.
 * Already-started games are handled by week-end hold, not this alert.
 */
export function hasUpcomingKickoffWithinHours(input: {
  kickoffs: Array<Date | null | undefined>;
  hours: number;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  const windowEnd = now.getTime() + input.hours * 60 * 60 * 1000;
  return input.kickoffs.some((kickoff) => {
    if (!kickoff || !Number.isFinite(kickoff.getTime())) return false;
    const ms = kickoff.getTime();
    return ms > now.getTime() && ms <= windowEnd;
  });
}
