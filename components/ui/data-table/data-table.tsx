"use client";

import type { CSSProperties } from "react";
import {
  flexRender,
  type Row,
  type Table as TanstackTable,
} from "@tanstack/react-table";

import { DataTablePagination, type ServerPaginationState } from "@/components/ui/data-table/data-table-pagination";
import {
  DataTableHeaderProvider,
  DEFAULT_DATA_TABLE_HEADER_CLASS,
} from "@/components/ui/data-table/data-table-header-context";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
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
  serverPagination?: ServerPaginationState;
  className?: string;
  headerClassName?: string;
  layout?: "auto" | "fixed";
  getRowClassName?: (row: Row<TData>) => string | undefined;
};

type ColumnLike = {
  id: string;
  columnDef: {
    meta?: {
      width?: number;
      sticky?: "left";
      headerClassName?: string;
      cellClassName?: string;
    };
  };
  getSize: () => number;
};

/** Fallback width for flexible columns when computing table min-width. */
const FLEX_COLUMN_MIN_WIDTH = 72;

const STICKY_LEFT_CLASSNAME =
  "max-md:sticky max-md:z-20 max-md:bg-background max-md:group-hover/tr:bg-muted/50 max-md:group-data-[state=selected]/tr:bg-muted";

const STICKY_LEFT_HEADER_CLASSNAME =
  "max-md:sticky max-md:z-30 max-md:bg-muted";

const STICKY_LEFT_EDGE_CLASSNAME =
  "max-md:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.45)]";

/** Only `meta.width` locks a column. Unset columns share remaining table width equally. */
function getFixedColumnWidth(column: ColumnLike): number | undefined {
  return column.columnDef.meta?.width;
}

function getColumnStyle(
  column: ColumnLike,
  fixedLayout: boolean,
  stickyLeft?: number,
): CSSProperties | undefined {
  const width = getFixedColumnWidth(column);
  const style: CSSProperties = {};

  if (width != null) {
    style.width = width;
    style.minWidth = width;
    style.maxWidth = width;
  } else if (!fixedLayout && stickyLeft != null) {
    // Sticky columns need a stable width so subsequent pins can offset correctly.
    const size = column.getSize();
    if (size > 0) {
      style.minWidth = size;
    }
  }

  if (stickyLeft != null) {
    style.left = stickyLeft;
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

function getFixedTableMinWidth(columns: ColumnLike[]): number {
  return columns.reduce(
    (sum, column) =>
      sum + (getFixedColumnWidth(column) ?? FLEX_COLUMN_MIN_WIDTH),
    0,
  );
}

function getStickyLeftOffsets(columns: ColumnLike[]): Map<string, number> {
  const offsets = new Map<string, number>();
  let left = 0;

  for (const column of columns) {
    if (column.columnDef.meta?.sticky !== "left") continue;
    offsets.set(column.id, left);
    left += getFixedColumnWidth(column) ?? column.getSize() ?? FLEX_COLUMN_MIN_WIDTH;
  }

  return offsets;
}

function isLastStickyLeftColumn(
  columns: ColumnLike[],
  columnId: string,
): boolean {
  let lastStickyId: string | null = null;
  for (const column of columns) {
    if (column.columnDef.meta?.sticky === "left") {
      lastStickyId = column.id;
    }
  }
  return lastStickyId === columnId;
}

export function DataTable<TData>({
  table,
  emptyMessage = "No results.",
  rowLabel,
  showPagination = true,
  serverPagination,
  className,
  headerClassName = DEFAULT_DATA_TABLE_HEADER_CLASS,
  layout = "auto",
  getRowClassName,
}: DataTableProps<TData>) {
  const columnCount = table.getAllColumns().length;
  const fixedLayout = layout === "fixed";
  const firstHeaderGroup = table.getHeaderGroups()[0];
  const visibleColumns =
    firstHeaderGroup?.headers.map((header) => header.column) ?? [];
  const stickyLeftOffsets = getStickyLeftOffsets(visibleColumns);
  const tableMinWidth =
    fixedLayout && firstHeaderGroup
      ? getFixedTableMinWidth(visibleColumns)
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
                    {headerGroup.headers.map((header) => {
                      const stickyLeft = stickyLeftOffsets.get(header.column.id);
                      const sticky = stickyLeft != null;

                      return (
                        <TableHead
                          key={header.id}
                          className={cn(
                            !sticky && "overflow-hidden",
                            "whitespace-nowrap",
                            headerClassName,
                            header.column.columnDef.meta?.headerClassName,
                            sticky && STICKY_LEFT_HEADER_CLASSNAME,
                            sticky &&
                              isLastStickyLeftColumn(
                                visibleColumns,
                                header.column.id,
                              ) &&
                              STICKY_LEFT_EDGE_CLASSNAME,
                          )}
                          style={getColumnStyle(
                            header.column,
                            fixedLayout,
                            stickyLeft,
                          )}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      );
                    })}
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
                      {row.getVisibleCells().map((cell) => {
                        const stickyLeft = stickyLeftOffsets.get(cell.column.id);
                        const sticky = stickyLeft != null;

                        return (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              !sticky && "overflow-hidden",
                              cell.column.columnDef.meta?.cellClassName,
                              sticky && STICKY_LEFT_CLASSNAME,
                              sticky &&
                                isLastStickyLeftColumn(
                                  visibleColumns,
                                  cell.column.id,
                                ) &&
                                STICKY_LEFT_EDGE_CLASSNAME,
                            )}
                            style={getColumnStyle(
                              cell.column,
                              fixedLayout,
                              stickyLeft,
                            )}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columnCount}
                      className="h-24 p-0 text-center"
                    >
                      <Empty className="border-none" size="sm">
                        <EmptyHeader>
                          <EmptyTitle>No results</EmptyTitle>
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
            <DataTablePagination
              table={table}
              rowLabel={rowLabel}
              serverPagination={serverPagination}
            />
          ) : null}
        </div>
      </DataTableHeaderProvider>
    </TooltipProvider>
  );
}
