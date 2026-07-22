export type DraftListStatusKind =
  | "unscheduled"
  | "in_progress"
  | "complete"
  | "scheduled";

export type DraftListStatus = {
  kind: DraftListStatusKind;
  label: string;
};

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
