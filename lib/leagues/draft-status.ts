export type DraftListStatusKind =
  | "unscheduled"
  | "in_progress"
  | "complete"
  | "scheduled";

export type DraftListStatus = {
  kind: DraftListStatusKind;
  label: string;
};

function dayOrdinal(day: number): string {
  const mod100 = day % 100;
  const mod10 = day % 10;
  let suffix = "th";
  if (mod100 < 11 || mod100 > 13) {
    if (mod10 === 1) suffix = "st";
    else if (mod10 === 2) suffix = "nd";
    else if (mod10 === 3) suffix = "rd";
  }
  return `${day}${suffix}`;
}

function formatDraftClockTime(date: Date): string {
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const hour12 = hours24 % 12 || 12;
  const meridiem = hours24 < 12 ? "am" : "pm";
  if (minutes === 0) {
    return `${hour12}${meridiem}`;
  }
  return `${hour12}:${String(minutes).padStart(2, "0")}${meridiem}`;
}

/** Format like `Starts at 9am on the 31st August, 2026`. */
export function formatDraftStartsAt(date: Date): string {
  const time = formatDraftClockTime(date);
  const day = dayOrdinal(date.getDate());
  const month = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(
    date,
  );
  const year = date.getFullYear();
  return `Starts at ${time} on the ${day} ${month}, ${year}`;
}

/** Format like `Fri 7 Aug 2026 16:00 BST`. */
export function formatDraftScheduledAt(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const weekday = get("weekday");
  const day = get("day");
  const month = get("month");
  const year = get("year");
  const hour = get("hour");
  const minute = get("minute");
  const timeZone = get("timeZoneName");

  return `${weekday} ${day} ${month} ${year} ${hour}:${minute} ${timeZone}`.trim();
}

export function resolveDraftListStatus(input: {
  status: string | null | undefined;
  draftStartAt: Date | null | undefined;
  draftType?: "live" | "email" | null;
}): DraftListStatus {
  if (input.status === "complete") {
    return { kind: "complete", label: "Draft Complete" };
  }

  if (input.status === "live" || input.status === "paused") {
    return {
      kind: "in_progress",
      label:
        input.draftType === "email" ? "In Progress (Email)" : "In Progress",
    };
  }

  if (input.draftStartAt) {
    return {
      kind: "scheduled",
      label: formatDraftScheduledAt(input.draftStartAt),
    };
  }

  return { kind: "unscheduled", label: "Unscheduled" };
}
