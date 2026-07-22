"use client";

import { DEFAULT_DATA_TABLE_HEADER_CLASS } from "@/components/ui/data-table/data-table-header-context";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type TeamTableColumnHeaderProps = {
  title: string;
  tooltip?: string;
  srOnly?: boolean;
  className?: string;
};

export function TeamTableColumnHeader({
  title,
  tooltip,
  srOnly,
  className,
}: TeamTableColumnHeaderProps) {
  if (srOnly) {
    return <span className="sr-only">{title}</span>;
  }

  const label = (
    <span className={cn(DEFAULT_DATA_TABLE_HEADER_CLASS, className)}>
      {title}
    </span>
  );

  if (!tooltip) {
    return label;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="inline-flex max-w-full items-center" />}
      >
        {label}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
