/** Format 0–100 rates for OWN / START cells. */
export function formatRosterRatePct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return `${Math.round(value)}%`;
}
