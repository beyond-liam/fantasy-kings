const DEFENSE_POSITION_IDS = new Set([
  "DEF",
  "DL",
  "LB",
  "DB",
  "CB",
  "S",
  "DT",
  "DE",
]);

const RING_SUCCESS =
  "after:border-1 after:border-success after:mix-blend-normal dark:after:mix-blend-normal";
const RING_DESTRUCTIVE =
  "after:border-1 after:border-destructive after:mix-blend-normal dark:after:mix-blend-normal";

export function possessionRing({
  primaryPositionId,
  hasPossession,
  inRedZone,
  isLive,
}: {
  primaryPositionId: string;
  hasPossession: boolean;
  inRedZone: boolean;
  isLive: boolean;
}): { className: string; label: string } | null {
  if (!isLive) return null;
  const isDefense = DEFENSE_POSITION_IDS.has(primaryPositionId);
  const onField = isDefense ? !hasPossession : hasPossession;
  if (!onField) return null;
  if (inRedZone) {
    return { className: RING_DESTRUCTIVE, label: "in the red zone" };
  }
  return {
    className: RING_SUCCESS,
    label: isDefense ? "defense on the field" : "has possession",
  };
}
