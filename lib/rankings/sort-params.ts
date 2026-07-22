import type { SortingState } from "@tanstack/react-table";

export const DEFAULT_SORT_COLUMN = "fantasy_pts";
export const DEFAULT_SORT_DESC = true;

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

  return {
    sort: sort.id === DEFAULT_SORT_COLUMN ? null : sort.id,
    sortDir: sort.desc ? null : "asc",
  };
}
