"use client";

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";

type ListPaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  label?: { singular: string; plural: string };
};

export function ListPagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  label = { singular: "item", plural: "items" },
}: ListPaginationProps) {
  if (total <= pageSize) {
    return null;
  }

  const itemLabel = total === 1 ? label.singular : label.plural;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        <span className="tabular-nums">{total}</span> {itemLabel}
        {" · Page "}
        <span className="tabular-nums">{page + 1}</span>
        {" of "}
        <span className="tabular-nums">{pageCount}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={page <= 0}
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
          onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
          disabled={page >= pageCount - 1}
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
