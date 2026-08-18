/** League draft pause windows use UK wall-clock time (GMT/BST). */
export const UK_TIME_ZONE = "Europe/London";

/**
 * Minutes since midnight in `Europe/London` for `date`.
 * Handles GMT ↔ BST automatically via the IANA zone.
 */
export function ukMinutesOfDay(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);

  return (
    (Number.isFinite(hour) ? hour : 0) * 60 +
    (Number.isFinite(minute) ? minute : 0)
  );
}

/** Short UK zone label for the given instant (`GMT` or `BST`). */
export function ukTimezoneAbbrev(date = new Date()): "GMT" | "BST" {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    timeZoneName: "short",
  }).formatToParts(date);
  const name = parts.find((part) => part.type === "timeZoneName")?.value;
  return name === "BST" ? "BST" : "GMT";
}

/** UK wall-clock date and time with no zone abbrev (e.g. `17 Aug 2026, 21:24`). */
export function formatUkDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: UK_TIME_ZONE,
  }).format(date);
}
