/** True when managers may pick. Window pause freezes the clock only. */
export function draftAllowsPicks(input: {
  status?: string | null;
  pausedByWindow?: boolean | null;
}): boolean {
  if (input.status === "live") {
    return true;
  }
  return input.status === "paused" && Boolean(input.pausedByWindow);
}
