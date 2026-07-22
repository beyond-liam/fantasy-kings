"use client";

import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type SortingState,
  type TableOptions,
  type Table as TanstackTable,
  type VisibilityState,
} from "@tanstack/react-table";

type UseDataTableOptions<TData> = {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
  pageSize?: number;
} & Omit<
  TableOptions<TData>,
  | "data"
  | "columns"
  | "state"
  | "onSortingChange"
  | "onColumnFiltersChange"
  | "onColumnVisibilityChange"
  | "getCoreRowModel"
  | "getFilteredRowModel"
  | "getPaginationRowModel"
  | "getSortedRowModel"
  | "initialState"
>;

export function useDataTable<TData>({
  data,
  columns,
  sorting,
  onSortingChange,
  columnFilters,
  onColumnFiltersChange,
  columnVisibility,
  onColumnVisibilityChange,
  pageSize = 25,
  ...options
}: UseDataTableOptions<TData>): TanstackTable<TData> {
  return useReactTable({
    data,
    columns,
    defaultColumn: {
      size: 80,
      minSize: 64,
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
    onSortingChange,
    onColumnFiltersChange,
    onColumnVisibilityChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...options,
  });
}
