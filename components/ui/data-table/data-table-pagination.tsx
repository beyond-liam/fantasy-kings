"use client";

import type { Table } from "@tanstack/react-table";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DataTableRowLabel = {
  singular: string;
  plural: string;
};

export type ServerPaginationState = {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
};

type DataTablePaginationProps<TData> = {
  table: Table<TData>;
  rowLabel?: DataTableRowLabel;
  /** When set, pagination navigates via URL / server instead of client row models. */
  serverPagination?: ServerPaginationState;
};

const PAGE_SIZE_ITEMS = [
  { label: "25", value: "25" },
  { label: "50", value: "50" },
  { label: "100", value: "100" },
] as const;

export function DataTablePagination<TData>({
  table,
  rowLabel = { singular: "row", plural: "rows" },
  serverPagination,
}: DataTablePaginationProps<TData>) {
  if (serverPagination) {
    const { page, pageSize, totalCount, onPageChange } = serverPagination;
    const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
    const label = totalCount === 1 ? rowLabel.singular : rowLabel.plural;

    return (
      <div className="flex flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="tabular-nums">{totalCount}</span> {label}
          {totalCount > 0 ? (
            <>
              {" · Page "}
              <span className="tabular-nums">{page}</span>
              {" of "}
              <span className="tabular-nums">{pageCount}</span>
            </>
          ) : null}
        </p>
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

  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const rowCount = table.getFilteredRowModel().rows.length;
  const label = rowCount === 1 ? rowLabel.singular : rowLabel.plural;

  return (
    <div className="flex flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        <span className="tabular-nums">{rowCount}</span> {label}
        {rowCount > 0 ? (
          <>
            {" · Page "}
            <span className="tabular-nums">{pageIndex + 1}</span>
            {" of "}
            <span className="tabular-nums">{Math.max(pageCount, 1)}</span>
          </>
        ) : null}
      </p>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows</span>
          <Select
            items={[...PAGE_SIZE_ITEMS]}
            value={String(pageSize)}
            onValueChange={(value) => {
              if (value) {
                table.setPageSize(Number(value));
              }
            }}
          >
            <SelectTrigger size="sm" className="w-18">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                {PAGE_SIZE_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
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
    </div>
  );
}
