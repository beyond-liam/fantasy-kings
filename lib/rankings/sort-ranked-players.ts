import {
  DEFAULT_POINTS_SORT_COLUMN,
  DEFAULT_POINTS_SORT_DESC,
} from "@/lib/rankings/sort-params";
import {
  getAdp,
  getFantasyPts,
  sortableRankValue,
  sortableStatValue,
} from "@/lib/rankings/stat-helpers";

type SortablePlayer = {
  fullName: string;
  fantasyPts: number | null;
  positionRank: number | null;
  stats: Record<string, number | null>;
};

function compareSortKey(
  a: SortablePlayer,
  b: SortablePlayer,
  sort: string,
): number {
  switch (sort) {
    case "positionRank":
      return (
        sortableRankValue(a.positionRank) - sortableRankValue(b.positionRank)
      );
    case "fantasy_pts":
      return (
        sortableStatValue(getFantasyPts(a)) - sortableStatValue(getFantasyPts(b))
      );
    case "adp":
      return sortableStatValue(getAdp(a.stats)) - sortableStatValue(getAdp(b.stats));
    default:
      return (
        sortableStatValue(a.stats[sort]) - sortableStatValue(b.stats[sort])
      );
  }
}

/** Stable compare for table sort + server pagination (name tie-break). */
export function compareRankedPlayers(
  a: SortablePlayer,
  b: SortablePlayer,
  sort: string = DEFAULT_POINTS_SORT_COLUMN,
  sortDesc: boolean = DEFAULT_POINTS_SORT_DESC,
): number {
  const cmp = compareSortKey(a, b, sort);
  if (cmp !== 0) {
    return sortDesc ? -cmp : cmp;
  }
  return a.fullName.localeCompare(b.fullName);
}

export function sortRankedPlayers<T extends SortablePlayer>(
  rows: T[],
  sort: string = DEFAULT_POINTS_SORT_COLUMN,
  sortDesc: boolean = DEFAULT_POINTS_SORT_DESC,
): T[] {
  return [...rows].sort((a, b) => compareRankedPlayers(a, b, sort, sortDesc));
}
