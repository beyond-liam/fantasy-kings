/** Display order for roster / trade tables (offense-first). */
export const ROSTER_POSITION_ORDER = [
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DEF",
] as const;

export function rosterPositionSortIndex(positionId: string) {
  const index = ROSTER_POSITION_ORDER.indexOf(
    positionId as (typeof ROSTER_POSITION_ORDER)[number],
  );
  return index === -1 ? ROSTER_POSITION_ORDER.length : index;
}

export function compareRosterPositions(a: string, b: string) {
  return rosterPositionSortIndex(a) - rosterPositionSortIndex(b);
}
