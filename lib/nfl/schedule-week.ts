const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
] as const;

const NFL_TZ = "America/New_York";

export type WeekWindow = {
  number: number;
  startDate: Date;
  endDate: Date;
};

/** Calendar day parts in America/New_York. */
function nyParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NFL_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

/**
 * ESPN `endDate` is an exclusive Wed-morning bound (often ~3am ET next week).
 * The displayable last day is the previous calendar day in America/New_York.
 */
function displayEndParts(endDate: Date) {
  const end = nyParts(endDate);
  const utc = new Date(Date.UTC(end.year, end.month - 1, end.day));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

/**
 * Format a week range for the filter dropdown.
 * Same month: `9 Sept - 15`
 * Cross month: `30 Sept - 6 Oct`
 */
export function formatWeekRange(startDate: Date, endDate: Date): string {
  const start = nyParts(startDate);
  const end = displayEndParts(endDate);

  const startMonth = MONTHS[start.month - 1];
  const endMonth = MONTHS[end.month - 1];

  if (start.month === end.month && start.year === end.year) {
    return `${start.day} ${startMonth} - ${end.day}`;
  }

  return `${start.day} ${startMonth} - ${end.day} ${endMonth}`;
}

/**
 * Forthcoming week using ESPN windows (Wed→Tue). Before the season starts,
 * returns week 1; after the final week ends, returns the last week.
 */
export function getDefaultScheduleWeek(
  weeks: WeekWindow[],
  now: Date = new Date(),
): number {
  if (weeks.length === 0) {
    return 1;
  }

  if (now < weeks[0].startDate) {
    return weeks[0].number;
  }

  for (const week of weeks) {
    if (now < week.endDate) {
      return week.number;
    }
  }

  return weeks[weeks.length - 1].number;
}

export function formatKickoffDay(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: NFL_TZ,
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatKickoffTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: NFL_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date);
}

export function dayKey(date: Date): string {
  const { year, month, day } = nyParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
