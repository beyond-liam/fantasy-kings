"use client";

import type { ReactNode } from "react";
import type { Column } from "@tanstack/react-table";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpDownIcon } from "@hugeicons/core-free-icons";

import { useDataTableHeaderClass } from "@/components/ui/data-table/data-table-header-context";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type DataTableColumnHeaderProps<TData, TValue> = {
  column: Column<TData, TValue>;
  title: string;
  tooltip?: string;
  className?: string;
};

function wrapWithTooltip(node: ReactNode, tooltip?: string) {
  if (!tooltip) {
    return node;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="inline-flex max-w-full items-center" />}
      >
        {node}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  tooltip,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const headerClassName = useDataTableHeaderClass();

  if (!column.getCanSort()) {
    return wrapWithTooltip(
      <div className={cn("text-xs uppercase", headerClassName, className)}>
        {title}
      </div>,
      tooltip,
    );
  }

  const sorted = column.getIsSorted();
  const sortButton = (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "group/header relative h-8 px-0 text-xs uppercase hover:bg-transparent dark:hover:bg-transparent",
        headerClassName,
        className,
      )}
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      <span className="truncate">{title}</span>
      <span className="inline-flex size-3 shrink-0" aria-hidden={!sorted}>
        <HugeiconsIcon
          icon={ArrowUpDownIcon}
          strokeWidth={2}
          className={cn(
            "size-3 text-foreground transition-[opacity,scale] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)]",
            sorted
              ? "scale-100 opacity-100"
              : "scale-[0.25] opacity-0 group-hover/header:scale-100 group-hover/header:opacity-100",
          )}
        />
      </span>
    </Button>
  );

  if (!tooltip) {
    return sortButton;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={sortButton} />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
