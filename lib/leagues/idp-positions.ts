/**
 * Individual defensive player positions.
 * Canonical IDs match Sleeper NFL `position` (not fantasy DL/DB buckets).
 * Display / filter / roster order: CB → S → DT → DE → LB.
 */
export const IDP_POSITION_IDS = ["CB", "S", "DT", "DE", "LB"] as const;

export type IdpPositionId = (typeof IDP_POSITION_IDS)[number];

export const IDP_POSITION_SET = new Set<string>(IDP_POSITION_IDS);

/** Starter slot defaults when applying the Offense + IDP roster preset. */
export const IDP_STARTER_SLOT_COUNTS: Record<IdpPositionId, number> = {
  CB: 2,
  S: 2,
  DT: 1,
  DE: 2,
  LB: 2,
};

/**
 * Map Sleeper NFL `position` → Fantasy Kings primary position.
 * Fantasy buckets (DL/DB) alone are not primary IDs — see depth-chart helper.
 */
export function mapSleeperNflPositionToPrimary(
  nflPosition: string | null | undefined,
): IdpPositionId | null {
  if (!nflPosition) return null;
  switch (nflPosition.toUpperCase()) {
    case "DE":
      return "DE";
    case "DT":
    case "NT":
      return "DT";
    case "LB":
    case "OLB":
    case "ILB":
    case "MLB":
      return "LB";
    case "CB":
      return "CB";
    case "S":
    case "FS":
    case "SS":
      return "S";
    default:
      return null;
  }
}

/**
 * When Sleeper's `position` is only DL/DB, refine from `depth_chart_position`.
 * Returns null when the depth label is missing or still ambiguous.
 */
export function mapSleeperDepthChartToPrimary(
  depthChartPosition: string | null | undefined,
): IdpPositionId | null {
  if (!depthChartPosition) return null;
  switch (depthChartPosition.toUpperCase()) {
    case "LCB":
    case "RCB":
    case "CB":
    case "NB":
      return "CB";
    case "FS":
    case "SS":
    case "S":
      return "S";
    case "LDE":
    case "RDE":
    case "DE":
    case "LOLB":
    case "ROLB":
      return "DE";
    case "LDT":
    case "RDT":
    case "DT":
    case "NT":
      return "DT";
    case "LB":
    case "MLB":
    case "ILB":
    case "LILB":
    case "RILB":
      return "LB";
    default:
      return null;
  }
}

/**
 * Resolve IDP primary id from Sleeper NFL position, with depth-chart
 * fallback when position is the coarse DL/DB bucket.
 */
export function resolveIdpPrimaryPosition(
  nflPosition: string | null | undefined,
  depthChartPosition?: string | null,
): IdpPositionId | null {
  const fromPosition = mapSleeperNflPositionToPrimary(nflPosition);
  if (fromPosition) return fromPosition;

  const bucket = nflPosition?.toUpperCase();
  if (bucket === "DL" || bucket === "DB") {
    return mapSleeperDepthChartToPrimary(depthChartPosition);
  }

  return null;
}

export function isIdpPosition(positionId: string): boolean {
  return IDP_POSITION_SET.has(positionId);
}
