"use client";

import type { CSSProperties } from "react";
import {
  flexRender,
  type Row,
  type Table as TanstackTable,
} from "@tanstack/react-table";

import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import {
  DataTableHeaderProvider,
  DEFAULT_DATA_TABLE_HEADER_CLASS,
} from "@/components/ui/data-table/data-table-header-context";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import "@/components/ui/data-table/types";

type DataTableRowLabel = {
  singular: string;
  plural: string;
};

type DataTableProps<TData> = {
  table: TanstackTable<TData>;
  emptyMessage?: string;
  rowLabel?: DataTableRowLabel;
  showPagination?: boolean;
  className?: string;
  headerClassName?: string;
  layout?: "auto" | "fixed";
  getRowClassName?: (row: Row<TData>) => string | undefined;
};

type ColumnLike = {
  id: string;
  columnDef: { meta?: { width?: number } };
};

/** Fallback width for flexible columns when computing table min-width. */
const FLEX_COLUMN_MIN_WIDTH = 72;

/** Only `meta.width` locks a column. Unset columns share remaining table width equally. */
function getFixedColumnWidth(column: ColumnLike): number | undefined {
  return column.columnDef.meta?.width;
}

function getColumnStyle(
  column: ColumnLike,
  fixedLayout: boolean,
): CSSProperties | undefined {
  const width = getFixedColumnWidth(column);
  if (width == null) {
    return undefined;
  }

  if (!fixedLayout) {
    return { width, minWidth: width, maxWidth: width };
  }

  return { width, minWidth: width, maxWidth: width };
}

function getFixedTableMinWidth(columns: ColumnLike[]): number {
  return columns.reduce(
    (sum, column) =>
      sum + (getFixedColumnWidth(column) ?? FLEX_COLUMN_MIN_WIDTH),
    0,
  );
}

export function DataTable<TData>({
  table,
  emptyMessage = "No results.",
  rowLabel,
  showPagination = true,
  className,
  headerClassName = DEFAULT_DATA_TABLE_HEADER_CLASS,
  layout = "auto",
  getRowClassName,
}: DataTableProps<TData>) {
  const columnCount = table.getAllColumns().length;
  const fixedLayout = layout === "fixed";
  const firstHeaderGroup = table.getHeaderGroups()[0];
  const tableMinWidth =
    fixedLayout && firstHeaderGroup
      ? getFixedTableMinWidth(firstHeaderGroup.headers.map((h) => h.column))
      : undefined;

  return (
    <TooltipProvider>
      <DataTableHeaderProvider headerClassName={headerClassName}>
        <div className={cn("flex flex-col gap-4", className)}>
          <TableShell>
            <Table
              className={cn(fixedLayout && "table-fixed")}
              style={
                tableMinWidth != null ? { minWidth: tableMinWidth } : undefined
              }
            >
              {fixedLayout && firstHeaderGroup ? (
                <colgroup>
                  {firstHeaderGroup.headers.map((header) => {
                    const width = getFixedColumnWidth(header.column);
                    return (
                      <col
                        key={header.id}
                        style={width != null ? { width } : undefined}
                      />
                    );
                  })}
                </colgroup>
              ) : null}
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          "overflow-hidden whitespace-nowrap",
                          headerClassName,
                          header.column.columnDef.meta?.headerClassName,
                        )}
                        style={getColumnStyle(header.column, fixedLayout)}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={getRowClassName?.(row)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "overflow-hidden",
                            cell.column.columnDef.meta?.cellClassName,
                          )}
                          style={getColumnStyle(cell.column, fixedLayout)}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columnCount}
                      className="h-24 p-0 text-center"
                    >
                      <Empty className="border-none p-6">
                        <EmptyHeader>
                          <EmptyDescription>{emptyMessage}</EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableShell>
          {showPagination ? (
            <DataTablePagination table={table} rowLabel={rowLabel} />
          ) : null}
        </div>
      </DataTableHeaderProvider>
    </TooltipProvider>
  );
}
