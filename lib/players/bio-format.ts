/** Sleeper often stores height as total inches ("77") or already as 6'5\". */
export function formatPlayerHeight(value: string | null | undefined) {
  if (!value?.trim()) return "—";
  const raw = value.trim();
  if (raw.includes("'") || raw.toLowerCase().includes("ft")) {
    return raw;
  }
  const inches = Number(raw);
  if (!Number.isFinite(inches) || inches <= 0) {
    return raw;
  }
  const feet = Math.floor(inches / 12);
  const rem = Math.round(inches % 12);
  return `${feet}'${rem}"`;
}

export function formatPlayerWeight(value: string | null | undefined) {
  if (!value?.trim()) return "—";
  const raw = value.trim();
  if (/lb/i.test(raw)) return raw;
  return `${raw} lbs`;
}

export function formatOwnershipPct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}
