"use client";

import type { Table } from "@tanstack/react-table";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { DataTablePageSizeSelect } from "@/components/ui/data-table/data-table-page-size-select";
import type { DataTablePageSize } from "@/components/ui/data-table/page-size";
import { Button } from "@/components/ui/button";

type DataTableRowLabel = {
  singular: string;
  plural: string;
};

export type ServerPaginationState = {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: DataTablePageSize) => void;
};

type DataTablePaginationProps<TData> = {
  table: Table<TData>;
  rowLabel?: DataTableRowLabel;
  /** When set, pagination navigates via URL / server instead of client row models. */
  serverPagination?: ServerPaginationState;
};

export function DataTablePagination<TData>({
  table,
  serverPagination,
}: DataTablePaginationProps<TData>) {
  if (serverPagination) {
    const { page, pageSize, totalCount, onPageChange, onPageSizeChange } =
      serverPagination;
    const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

    return (
      <div className="flex flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-between">
        <DataTablePageSizeSelect
          pageSize={pageSize}
          totalCount={totalCount}
          onPageSizeChange={onPageSizeChange}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
          >
            Next
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              strokeWidth={2}
              data-icon="inline-end"
            />
          </Button>
        </div>
      </div>
    );
  }

  const { pageSize } = table.getState().pagination;
  const rowCount = table.getFilteredRowModel().rows.length;

  return (
    <div className="flex flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-between">
      <DataTablePageSizeSelect
        pageSize={pageSize}
        totalCount={rowCount}
        onPageSizeChange={(next) => table.setPageSize(next)}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            strokeWidth={2}
            data-icon="inline-end"
          />
        </Button>
      </div>
    </div>
  );
}
