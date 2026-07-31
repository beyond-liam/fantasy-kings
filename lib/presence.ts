import { format } from "date-fns";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const PRESENCE_ONLINE_WINDOW_MS = 2 * MINUTE_MS;
export const IN_SEASON_INACTIVITY_MS = 14 * DAY_MS;
export const OFFSEASON_INACTIVITY_MS = 30 * DAY_MS;

export type PresenceStatus = "online" | "offline" | "inactive";

export function formatPresenceLabel({
  status,
  lastSeenAt,
}: {
  status: PresenceStatus;
  lastSeenAt: Date;
}): string {
  if (status === "online") {
    return "Online";
  }

  const date = format(lastSeenAt, "do MMM yyyy");
  return status === "inactive"
    ? `Inactive since ${date}`
    : `Last seen ${date}`;
}

export function isInSeasonNflPhase(seasonType: string): boolean {
  return seasonType === "regular" || seasonType === "post";
}

export function getInactivityWindowMs(seasonType: string): number {
  return isInSeasonNflPhase(seasonType)
    ? IN_SEASON_INACTIVITY_MS
    : OFFSEASON_INACTIVITY_MS;
}

export function resolvePresenceStatus({
  lastSeenAt,
  nflSeasonType,
  now = new Date(),
}: {
  lastSeenAt: Date;
  nflSeasonType: string;
  now?: Date;
}): PresenceStatus {
  const elapsedMs = Math.max(0, now.getTime() - lastSeenAt.getTime());

  if (elapsedMs <= PRESENCE_ONLINE_WINDOW_MS) {
    return "online";
  }

  if (elapsedMs >= getInactivityWindowMs(nflSeasonType)) {
    return "inactive";
  }

  return "offline";
}
