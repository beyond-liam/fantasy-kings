export const TRADE_OFFER_EXPIRY_PRESETS = [
  "never",
  "1h",
  "eod",
  "24h",
  "2d",
  "7d",
  "14d",
] as const;

export type TradeOfferExpiryPreset =
  (typeof TRADE_OFFER_EXPIRY_PRESETS)[number];

export const TRADE_OFFER_EXPIRY_OPTIONS: Array<{
  value: TradeOfferExpiryPreset;
  label: string;
}> = [
  { value: "never", label: "Offer expires when accepted" },
  { value: "1h", label: "Offer expires in 1 hour" },
  { value: "eod", label: "Offer expires at end of day" },
  { value: "24h", label: "Offer expires in 24 hours" },
  { value: "2d", label: "Offer expires in 2 days" },
  { value: "7d", label: "Offer expires in 7 days" },
  { value: "14d", label: "Offer expires in 14 days" },
];

/** Resolve a preset to an absolute expiry (local calendar for end-of-day). */
export function resolveTradeOfferExpiresAt(
  preset: TradeOfferExpiryPreset,
  now = new Date(),
): Date | null {
  switch (preset) {
    case "never":
      return null;
    case "1h":
      return new Date(now.getTime() + 60 * 60 * 1000);
    case "eod": {
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      if (end.getTime() <= now.getTime()) {
        end.setDate(end.getDate() + 1);
      }
      return end;
    }
    case "24h":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "2d":
      return new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "14d":
      return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

export function isTradeOfferExpiryPreset(
  value: string,
): value is TradeOfferExpiryPreset {
  return (TRADE_OFFER_EXPIRY_PRESETS as readonly string[]).includes(value);
}
