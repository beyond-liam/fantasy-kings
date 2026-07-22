import type { WaiverProcessDay } from "@/db/schema/league-seasons";

const PROCESS_HOUR_UTC = 10;
/** Claims must be submitted by this many hours before process (e.g. 09:00 for 10:00). */
const CLAIM_DEADLINE_OFFSET_HOURS = 1;
const FCFS_OFFSET_HOURS = 2;
/** Week rolls at Wednesday 00:01 UTC. */
const WEEK_START_DOW = 3; // Wednesday
const WEEK_START_MINUTE = 1;

const DOW_TO_UTC: Record<WaiverProcessDay, number> = {
  sun: 0,
  mon: 1,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export function getFantasyWeekStartUtc(now: Date = new Date()): Date {
  const date = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      WEEK_START_MINUTE,
      0,
      0,
    ),
  );

  const dow = date.getUTCDay();
  let daysSinceWed = (dow - WEEK_START_DOW + 7) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceWed);

  // If we're Wed but still before 00:01, belong to previous week.
  if (
    now.getUTCDay() === WEEK_START_DOW &&
    (now.getUTCHours() === 0 && now.getUTCMinutes() < WEEK_START_MINUTE)
  ) {
    date.setUTCDate(date.getUTCDate() - 7);
  } else if (now < date) {
    date.setUTCDate(date.getUTCDate() - 7);
  }

  return date;
}

export function getNextFantasyWeekStartUtc(now: Date = new Date()): Date {
  const start = getFantasyWeekStartUtc(now);
  const next = new Date(start);
  next.setUTCDate(next.getUTCDate() + 7);
  return next;
}

/** Most recent process instant (processDay @ 10:00 UTC) that is <= now. */
export function getLastProcessInstantUtc(
  processDays: WaiverProcessDay[],
  now: Date = new Date(),
): Date | null {
  if (processDays.length === 0) {
    return null;
  }

  let latest: Date | null = null;
  for (const day of processDays) {
    const candidate = mostRecentWeekdayAtHourUtc(
      DOW_TO_UTC[day],
      PROCESS_HOUR_UTC,
      now,
    );
    if (!latest || candidate > latest) {
      latest = candidate;
    }
  }
  return latest;
}

export function getNextProcessInstantUtc(
  processDays: WaiverProcessDay[],
  now: Date = new Date(),
): Date | null {
  if (processDays.length === 0) {
    return null;
  }

  let soonest: Date | null = null;
  for (const day of processDays) {
    const candidate = nextWeekdayAtHourUtc(
      DOW_TO_UTC[day],
      PROCESS_HOUR_UTC,
      now,
    );
    if (!soonest || candidate < soonest) {
      soonest = candidate;
    }
  }
  return soonest;
}

export function getFcfsOpensAtUtc(processInstant: Date): Date {
  const opens = new Date(processInstant);
  opens.setUTCHours(opens.getUTCHours() + FCFS_OFFSET_HOURS);
  return opens;
}

/** Claim cutoff for a given process instant (process − 1h). */
export function getClaimDeadlineForProcess(processInstant: Date): Date {
  const deadline = new Date(processInstant);
  deadline.setUTCHours(deadline.getUTCHours() - CLAIM_DEADLINE_OFFSET_HOURS);
  return deadline;
}

/**
 * True when a claim submitted at `createdAt` is eligible for `processInstant`
 * (at or before that run's deadline).
 */
export function isClaimEligibleForProcess(
  createdAt: Date,
  processInstant: Date,
): boolean {
  return (
    createdAt.getTime() <= getClaimDeadlineForProcess(processInstant).getTime()
  );
}

/**
 * Next process run that would include a claim submitted at `now`
 * (skips today's run if past the claim deadline).
 */
export function getNextEligibleProcessInstantUtc(
  processDays: WaiverProcessDay[],
  now: Date = new Date(),
): Date | null {
  let cursor = now;
  for (let attempt = 0; attempt < 14; attempt++) {
    const process = getNextProcessInstantUtc(processDays, cursor);
    if (!process) {
      return null;
    }
    if (now < getClaimDeadlineForProcess(process)) {
      return process;
    }
    cursor = new Date(process.getTime() + 1000);
  }
  return null;
}

/**
 * True when `now` is inside the post-process run window for the most recent
 * scheduled process instant, and that instant has not been handled yet.
 *
 * Window: [processInstant, processInstant + graceMinutes).
 * Designed for an hourly cron hitting at/after 10:00 UTC.
 */
export function isWaiverProcessDue(input: {
  processDays: WaiverProcessDay[];
  lastWaiverProcessedAt: Date | null | undefined;
  now?: Date;
  graceMinutes?: number;
}): boolean {
  const now = input.now ?? new Date();
  const graceMs = (input.graceMinutes ?? 60) * 60 * 1000;
  const processInstant = getLastProcessInstantUtc(input.processDays, now);
  if (!processInstant) {
    return false;
  }
  if (now < processInstant) {
    return false;
  }
  if (now.getTime() - processInstant.getTime() >= graceMs) {
    return false;
  }
  if (
    input.lastWaiverProcessedAt &&
    input.lastWaiverProcessedAt.getTime() >= processInstant.getTime()
  ) {
    return false;
  }
  return true;
}

/**
 * Free-agent FCFS is open after the last process + 2h, until the next process.
 * (No timezone conversion — all UTC.)
 */
export function isFcfsWindowOpen(
  processDays: WaiverProcessDay[],
  now: Date = new Date(),
): boolean {
  const last = getLastProcessInstantUtc(processDays, now);
  if (!last) {
    return false;
  }
  const opens = getFcfsOpensAtUtc(last);
  if (now < opens) {
    return false;
  }
  const next = getNextProcessInstantUtc(processDays, now);
  if (next && now >= next) {
    return false;
  }
  return true;
}

function mostRecentWeekdayAtHourUtc(
  weekday: number,
  hour: number,
  now: Date,
): Date {
  const date = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hour,
      0,
      0,
      0,
    ),
  );
  const delta = (date.getUTCDay() - weekday + 7) % 7;
  date.setUTCDate(date.getUTCDate() - delta);
  if (date > now) {
    date.setUTCDate(date.getUTCDate() - 7);
  }
  return date;
}

function nextWeekdayAtHourUtc(
  weekday: number,
  hour: number,
  now: Date,
): Date {
  const date = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hour,
      0,
      0,
      0,
    ),
  );
  const delta = (weekday - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + delta);
  if (date <= now) {
    date.setUTCDate(date.getUTCDate() + 7);
  }
  return date;
}

export const WAIVER_PROCESS_HOUR_UTC = PROCESS_HOUR_UTC;
export const WAIVER_CLAIM_DEADLINE_OFFSET_HOURS = CLAIM_DEADLINE_OFFSET_HOURS;
export const WAIVER_FCFS_OFFSET_HOURS = FCFS_OFFSET_HOURS;
