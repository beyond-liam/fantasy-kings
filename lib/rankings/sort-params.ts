import type { SortingState } from "@tanstack/react-table";

/** Default sort for Rankings / League Players tables. */
export const DEFAULT_SORT_COLUMN = "positionRank";
export const DEFAULT_SORT_DESC = false;

/** Default when getRankedPlayers / draft / BPA omit sort. */
export const DEFAULT_POINTS_SORT_COLUMN = "fantasy_pts";
export const DEFAULT_POINTS_SORT_DESC = true;

export function resolvePlayersTableKind(
  kindParam: string | undefined | null,
  seasonStarted: boolean,
): "projection" | "stats" {
  if (kindParam === "stats" || kindParam === "projection") {
    return kindParam;
  }
  return seasonStarted ? "stats" : "projection";
}

/** Omit the URL param when it matches the in-season / pre-season default. */
export function playersTableKindQueryValue(
  kind: "projection" | "stats",
  seasonStarted: boolean,
): string | null {
  const fallback = seasonStarted ? "stats" : "projection";
  return kind === fallback ? null : kind;
}

export function defaultSortDescForColumn(column: string): boolean {
  return column !== "positionRank";
}

export function parseRequestedSort(
  sortParam?: string | null,
  sortDirParam?: string | null,
): { sort: string; sortDesc: boolean } {
  const sort =
    sortParam === "pts_ppr"
      ? DEFAULT_POINTS_SORT_COLUMN
      : (sortParam ?? DEFAULT_SORT_COLUMN);
  const sortDesc = sortDirParam
    ? sortDirParam !== "asc"
    : defaultSortDescForColumn(sort);
  return { sort, sortDesc };
}

export function parseSortingFromParams(
  sort?: string | null,
  sortDesc: boolean = DEFAULT_SORT_DESC,
): SortingState {
  return [
    {
      id: sort ?? DEFAULT_SORT_COLUMN,
      desc: sortDesc,
    },
  ];
}

export function sortingToParams(
  sorting: SortingState,
): Record<string, string | null> {
  const sort = sorting[0];
  if (!sort) {
    return { sort: null, sortDir: null };
  }

  const isDefault =
    sort.id === DEFAULT_SORT_COLUMN && sort.desc === DEFAULT_SORT_DESC;

  if (isDefault) {
    return { sort: null, sortDir: null };
  }

  const defaultDesc = defaultSortDescForColumn(sort.id);
  return {
    sort: sort.id === DEFAULT_SORT_COLUMN ? null : sort.id,
    sortDir:
      sort.desc === defaultDesc ? null : sort.desc ? "desc" : "asc",
  };
}
