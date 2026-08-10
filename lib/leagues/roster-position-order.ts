/** Display order for roster / trade tables (offense-first, then team DEF, then IDP). */
export const ROSTER_POSITION_ORDER = [
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DEF",
  "CB",
  "S",
  "DT",
  "DE",
  "LB",
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
